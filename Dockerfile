# Builds one image that serves both halves: the React bundle is baked into the jar's static
# resources, so a single container answers / with the UI and /api/... with JSON.

# ---- 1. the React bundle ----
FROM node:24-alpine AS frontend
WORKDIR /frontend
# Dependencies first: this layer is only rebuilt when the lock file changes, not on every edit.
COPY src/main/frontend/package.json src/main/frontend/package-lock.json ./
RUN npm ci
COPY src/main/frontend/ ./
RUN npm run build

# ---- 2. the jar, with the bundle inside it ----
FROM eclipse-temurin:21-jdk AS backend
WORKDIR /build
# Same idea: resolve dependencies from the pom alone, so source edits don't re-download Maven.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -B dependency:go-offline
COPY src/ src/
COPY --from=frontend /frontend/dist/ src/main/resources/static/
# Tests already ran in CI; repeating them here would only slow every deploy.
RUN ./mvnw -B package -DskipTests

# ---- 3. what actually ships ----
# JRE, not JDK: running a jar needs no compiler, and shipping one is dead weight and attack surface.
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
RUN useradd --create-home --shell /usr/sbin/nologin app
USER app
COPY --from=backend /build/target/*.jar app.jar
# Documentation only — the real port comes from PORT at runtime.
EXPOSE 8080
# The JVM sizes its heap from the container's memory limit, not the host's. Without this it can
# claim far more than a 512MB instance has and be killed on startup.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
