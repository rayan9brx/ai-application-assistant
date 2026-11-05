param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [int]$Port = 55433
)
$ErrorActionPreference = 'Stop'
# Run against a new loopback-only cluster; never touch the installed service's data.
$testRoot = Join-Path $PSScriptRoot ('target\postgres-tests-' + [guid]::NewGuid().ToString('N'))
$testData = Join-Path $testRoot 'data'
$passwordFile = Join-Path $testRoot 'password'
$previousUrl = $env:TEST_DB_URL
$previousUser = $env:TEST_DB_USERNAME
$previousPassword = $env:TEST_DB_PASSWORD
$started = $false
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $env:TEST_DB_PASSWORD = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    [IO.File]::WriteAllText($passwordFile, $env:TEST_DB_PASSWORD)
    & (Join-Path $PostgresBin 'initdb.exe') -D $testData -U draft_test --auth=scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL initialization failed.' }
    Remove-Item -LiteralPath $passwordFile
    & (Join-Path $PostgresBin 'pg_ctl.exe') -D $testData -l (Join-Path $testRoot 'postgres.log') -o "-h 127.0.0.1 -p $Port" -w start
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL startup failed. Check that the test port is unused.' }
    $started = $true
    $env:TEST_DB_URL = "jdbc:postgresql://127.0.0.1:$Port/postgres"
    $env:TEST_DB_USERNAME = 'draft_test'
    Push-Location $PSScriptRoot
    try {
        & .\mvnw.cmd test
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL backend tests failed.' }
    } finally { Pop-Location }
} finally {
    if ($started) { & (Join-Path $PostgresBin 'pg_ctl.exe') -D $testData -m fast -w stop }
    if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
    $env:TEST_DB_URL = $previousUrl
    $env:TEST_DB_USERNAME = $previousUser
    $env:TEST_DB_PASSWORD = $previousPassword
    # Leave stopped synthetic test data under ignored target/ for inspection.
}
