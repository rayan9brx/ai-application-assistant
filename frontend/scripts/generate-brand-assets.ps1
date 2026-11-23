# Generates the favicon, app icons and the social share image from public/brand/.
# Run from the repository root after changing the logo:
#   powershell -ExecutionPolicy Bypass -File frontend/scripts/generate-brand-assets.ps1
# Uses only System.Drawing (built into Windows), so nothing needs to be installed.
# The colours below are the design tokens from src/styles.scss (--primary-*, theme-dark --bg/--text).

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$public = Join-Path $PSScriptRoot '..\public' | Resolve-Path
$source = [System.Drawing.Image]::FromFile((Join-Path $public 'brand\logo-purple.jpg'))

# The app icon's rounded corners, as a share of its width (measured on logo-purple.jpg).
$cornerShare = 0.215

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Set-Quality($g) {
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
}

# The JPEG scaled to $size, with its white corners replaced: transparent ($fill = $false) or
# filled with the icon's own colours ($fill = $true, for iOS, which masks icons itself).
function New-Icon([int]$size, [bool]$fill) {
  $scaled = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($scaled)
  Set-Quality $g
  $attributes = New-Object System.Drawing.Imaging.ImageAttributes
  $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $g.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
  $g.Dispose()

  $icon = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($icon)
  Set-Quality $g
  if ($fill) {
    # Behind the rounded icon: the same image 25% larger, so the corners get its own colours.
    $big = $size * 1.25
    $g.DrawImage($source, (New-Object System.Drawing.RectangleF (-($big - $size) / 2), (-($big - $size) / 2), $big, $big))
  }
  # A small inset keeps the JPEG's anti-aliased white edge out of the result.
  $inset = [Math]::Max(0.5, $size * 0.004)
  $path = New-RoundedPath $inset $inset ($size - 2 * $inset) ($size - 2 * $inset) ($size * $cornerShare)
  $g.FillPath((New-Object System.Drawing.TextureBrush $scaled), $path)
  $g.Dispose()
  $scaled.Dispose()
  return $icon
}

function Save-Png($bitmap, [string]$name) {
  $file = Join-Path $public $name
  $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "  $name ($($bitmap.Width)x$($bitmap.Height))"
}

function Get-PngBytes($bitmap) {
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  return , $stream.ToArray()
}

Write-Host 'Writing to' $public

# favicon.ico with 16, 32 and 48 px PNG images inside.
$sizes = 16, 32, 48
$images = foreach ($s in $sizes) { , (Get-PngBytes (New-Icon $s $false)) }
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $ico
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $w.Write([byte]$sizes[$i]); $w.Write([byte]$sizes[$i]); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32)
  $w.Write([UInt32]$images[$i].Length); $w.Write([UInt32]$offset)
  $offset += $images[$i].Length
}
foreach ($bytes in $images) { $w.Write($bytes) }
$w.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $public 'favicon.ico'), $ico.ToArray())
Write-Host '  favicon.ico (16, 32, 48)'

Save-Png (New-Icon 192 $false) 'icon-192.png'
Save-Png (New-Icon 512 $false) 'icon-512.png'
Save-Png (New-Icon 180 $true) 'apple-touch-icon.png'

# og-image.png (1200x630): white mark + app name and the tagline on the dark navy background.
$appName = 'Rezumo'
# Two lines, broken after 'interviews'.
$tagline = "Land more interviews`nwith an AI-powered CV"
$og = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($og)
Set-Quality $g
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0F1629'))
# A soft purple glow behind the logo.
$glow = New-Object System.Drawing.Drawing2D.GraphicsPath
$glow.AddEllipse(150, -260, 900, 760)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $glow
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(90, [System.Drawing.ColorTranslator]::FromHtml('#5B4FD6'))
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, [System.Drawing.ColorTranslator]::FromHtml('#5B4FD6')))
$g.FillPath($glowBrush, $glow)

$white = [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF')
$nameFont = New-Object System.Drawing.Font 'Segoe UI', 64, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$tagFont = New-Object System.Drawing.Font 'Segoe UI Semibold', 54, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)

# The mark from logo-mark.svg (shapes within x 72-447, y 115-418), scaled to 96 px high.
$markHeight = 96
$scale = $markHeight / 303
$markWidth = 375 * $scale
$nameSize = $g.MeasureString($appName, $nameFont)
$gap = 26
$rowWidth = $markWidth + $gap + $nameSize.Width
$left = (1200 - $rowWidth) / 2
$top = 150
$state = $g.Save()
$g.TranslateTransform($left - 72 * $scale, $top - 115 * $scale)
$g.ScaleTransform($scale, $scale)
$brush = New-Object System.Drawing.SolidBrush $white
$g.FillEllipse($brush, 118 - 46, 372 - 46, 92, 92)
$pen = New-Object System.Drawing.Pen $white, 74
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawLines($pen, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF 186, 152), (New-Object System.Drawing.PointF 270, 352), (New-Object System.Drawing.PointF 364, 248)))
$g.DrawLine($pen, 322, 152, 410, 352)
$g.Restore($state)
$g.DrawString($appName, $nameFont, $brush, $left + $markWidth + $gap, $top + ($markHeight - $nameSize.Height) / 2)

$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$taglineBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F5F6FA'))
$g.DrawString($tagline, $tagFont, $taglineBrush, (New-Object System.Drawing.RectangleF 120, 320, 960, 200), $format)
# A thin accent line under the tagline.
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#8577EE'))
$g.FillRectangle($accent, 560, 500, 80, 6)
$g.Dispose()
Save-Png $og 'og-image.png'

$source.Dispose()
Write-Host 'Done.'
