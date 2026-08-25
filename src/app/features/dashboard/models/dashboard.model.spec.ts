import { DashboardModel } from './dashboard.model';

describe('DashboardModel', () => {
  it('starts disconnected', () => {
    const model = new DashboardModel();
    let status = { connected: true, connecting: true };
    model.connectionStatus$.subscribe(value => {
      status = value;
    });
    expect(status.connected).toBe(false);
    expect(status.connecting).toBe(false);
  });

  it('stays disconnected when no hardware backend and no devices', async () => {
    const model = new DashboardModel();
    await model.ConnectToDevice();
    let status = { connected: true, connecting: true };
    model.connectionStatus$.subscribe(value => {
      status = value;
    });
    expect(status.connecting).toBe(false);
    expect(status.connected).toBe(false);
  });

  it('connects when the backend returns one device', async () => {
    const backend = {
      getDeviceList: async () => [{ Address: 'usb-1' }],
      establishLink: async () => ({ connected: true })
    };
    const model = new DashboardModel(undefined, backend);
    await model.ConnectToDevice();
    let status = { connected: false, connecting: true };
    model.connectionStatus$.subscribe(value => {
      status = value;
    });
    expect(status.connected).toBe(true);
    expect(status.connecting).toBe(false);
  });
});
