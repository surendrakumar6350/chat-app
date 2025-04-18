import { WebSocket } from 'ws';


describe('WebSocket Server', () => {
  it('should connect to the WebSocket server and receive a client ID', (done) => {
    const ws = new WebSocket('ws://localhost:8080');

    ws.on('open', () => {
      console.log('WebSocket connection opened');
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message.type).toBe('yourId');
      expect(message.message).toBeDefined();
      expect(message.onlineUsers).toBeGreaterThanOrEqual(1);
      ws.close();
      done();
    });

    ws.on('error', (err) => {
      done(err);
    });
  });

  it('should reject connections exceeding the max connections per IP', (done) => {
    const connections: WebSocket[] = [];

    for (let i = 0; i < 6; i++) {
      const ws = new WebSocket('ws://localhost:8080');
      connections.push(ws);

      ws.on('close', (code) => {
        if (i === 5) {
          expect(code).toBe(1008);
          connections.forEach((conn) => conn.close());
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });
    }
  });
});