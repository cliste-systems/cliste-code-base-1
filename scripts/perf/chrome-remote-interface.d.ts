declare module "chrome-remote-interface" {
  type CdpClient = {
    Network: {
      enable: () => Promise<void>;
      setCookie: (cookie: Record<string, unknown>) => Promise<unknown>;
    };
    close: () => Promise<void>;
  };

  export default function CDP(options: { port: number }): Promise<CdpClient>;
}
