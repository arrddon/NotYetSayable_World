import http from 'node:http';
import {serveStatic} from './static-server.mjs';
const server=http.createServer(serveStatic);
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
