import { HardwareConnectionService } from './hardware-connection.service';

describe('HardwareConnectionService', () => {
  it('starts disconnected', () => {
    const service = new HardwareConnectionService();
    expect(service.snapshot.connected).toBe(false);
    expect(service.snapshot.connecting).toBe(false);
  });

  it('toggles connected after connectToDevice', async () => {
    const service = new HardwareConnectionService();
    const pending = service.connectToDevice();
    expect(service.snapshot.connecting).toBe(true);
    await pending;
    expect(service.snapshot.connecting).toBe(false);
    expect(service.snapshot.connected).toBe(true);
  });
});
