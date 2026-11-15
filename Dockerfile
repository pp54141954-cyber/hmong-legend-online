# Hmong Legend — เซิร์ฟเวอร์เกม (Node.js 22 + ws + SQLite ในตัว)
# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080 DB_FILE=/data/hmong.db TRUST_PROXY=1
WORKDIR /app
COPY server/package.json server/package-lock.json server/
# ใบรับรอง CA เพิ่มเติม (ไม่บังคับ) สำหรับเครื่องที่ออกเน็ตผ่าน proxy องค์กร: docker build --secret id=ca,src=ca.crt
RUN --mount=type=secret,id=ca,required=false cd server && if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi && npm ci --omit=dev --no-audit --no-fund
COPY server/*.js server/
COPY shared/ shared/
COPY game/index.html game/
COPY game/maps/ game/maps/
COPY game/sprites/ game/sprites/
COPY game/icons/ game/icons/
COPY tools/backup-db.js tools/
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--no-warnings", "server/server.js"]
