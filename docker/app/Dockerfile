# The app, built and run the way scripts/setup-ec2.sh / deploy-ec2.sh do it on
# the server: `npm run build` (which reads the database to prerender pages,
# so it runs at container start, once MySQL is up), then the standalone
# server as a non-root user.
FROM node:22-slim
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN mkdir -p /app/logs && chown node:node /app /app/logs
USER node
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
CMD ["sh", "docker/app/start.sh"]
