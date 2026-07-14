FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV GRADLE_VERSION=8.5
ENV PATH="${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:/opt/gradle/bin"

# -------------------------------------------------------------------
# Install system dependencies:
# - Build essentials and utilities: curl, wget, unzip, git
# - Java 17 for Android builds
# - Shared libraries required by Puppeteer / Chromium
# -------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    unzip \
    git \
    openjdk-17-jdk-headless \
    fonts-noto-cjk \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libu2f-udev \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# -------------------------------------------------------------------
# Node.js 20 (required by the worker runtime and Capacitor CLI)
# -------------------------------------------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# -------------------------------------------------------------------
# Gradle (system-wide, for Android build convenience)
# -------------------------------------------------------------------
RUN wget -q "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" \
        -O /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s "/opt/gradle-${GRADLE_VERSION}" /opt/gradle && \
    rm /tmp/gradle.zip

# -------------------------------------------------------------------
# Capacitor CLI (global install so `npx cap` works consistently)
# -------------------------------------------------------------------
RUN npm install -g @capacitor/cli@latest @capacitor/core@latest @capacitor/android@latest

# -------------------------------------------------------------------
# Android SDK command-line tools
# -------------------------------------------------------------------
RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
        -O /tmp/cmdtools.zip && \
    unzip -q /tmp/cmdtools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools && \
    mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest && \
    rm /tmp/cmdtools.zip

# Accept Android SDK licenses
RUN yes | ${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager --licenses

# Install SDK packages required for Capacitor Android builds
RUN ${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager \
    "platform-tools" \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "extras;google;m2repository" \
    "extras;android;m2repository"

# -------------------------------------------------------------------
# Application setup
# -------------------------------------------------------------------
WORKDIR /app

# Configure Gradle mirrors (essential for builds in China)
RUN mkdir -p /root/.gradle
RUN printf 'allprojects {\n\
    repositories {\n\
        maven { url "https://maven.aliyun.com/repository/public" }\n\
        maven { url "https://maven.aliyun.com/repository/google" }\n\
        maven { url "https://maven.aliyun.com/repository/gradle-plugin" }\n\
        maven { url "https://maven.aliyun.com/repository/central" }\n\
        google()\n\
        mavenCentral()\n\
    }\n\
}\n\
\n\
settingsEvaluated { settings ->\n\
    settings.pluginManagement.repositories {\n\
        maven { url "https://maven.aliyun.com/repository/gradle-plugin" }\n\
        maven { url "https://maven.aliyun.com/repository/public" }\n\
        gradlePluginPortal()\n\
        google()\n\
        mavenCentral()\n\
    }\n\
}\n\
' > /root/.gradle/init.gradle

# Preserve monorepo structure so relative imports (../../shared/) resolve
COPY worker/package.json worker/package-lock.json* ./worker/
WORKDIR /app/worker
RUN npm install
COPY worker/tsconfig.json ./
COPY worker/src/ ./src/
COPY worker/template/ ./template/
COPY shared/ /app/shared/
RUN npm run build

CMD ["node", "dist/worker/src/index.js"]
