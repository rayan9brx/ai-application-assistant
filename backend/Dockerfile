# Build stage: compile and package the app with the project's Maven wrapper.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# Download dependencies first so they are cached between builds when only the code changes.
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src src
# Tests need a database and API keys, so they are not run during the image build.
RUN ./mvnw -B -q package -DskipTests && cp target/*.jar app.jar

# Run stage: JRE only, as a non-root user.
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 spring
COPY --from=build /workspace/app.jar app.jar
USER spring

# application.properties binds to 127.0.0.1 for local use; in a container the app must listen on
# all interfaces so Render can reach it. Render sets PORT; server.port defaults to 8080.
ENV SERVER_ADDRESS=0.0.0.0
EXPOSE 8080

ENTRYPOINT ["java", "-Xmx300m", "-jar", "app.jar"]
