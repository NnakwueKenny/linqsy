declare module 'qrcode' {
  export type QRCodeToStringOptions = {
    color?: {
      dark?: string;
      light?: string;
    };
    margin?: number;
    type?: 'svg' | 'utf8';
    width?: number;
  };

  const QRCode: {
    toString(text: string, options?: QRCodeToStringOptions): Promise<string>;
  };

  export default QRCode;
}
