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
  }, 30000);

});
