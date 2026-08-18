cd /opt/mxv-checklist/mock-sftp
npm install
pm2 start server.js --name "mock-sftp"


pm2 delete mock-sftp && rm -rf /opt/mxv-checklist/mock-sftp