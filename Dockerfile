FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# .git is dockerignored — pass identity from host deploy script
ARG BUILD_COMMIT=unknown
ARG BUILD_BRANCH=unknown
ARG BUILD_RELEASE=unknown
ENV VITE_BUILD_COMMIT=$BUILD_COMMIT \
    VITE_BUILD_BRANCH=$BUILD_BRANCH \
    VITE_BUILD_RELEASE=$BUILD_RELEASE
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
