import { useEffect, useState } from 'react';

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

export function useWebGLSupport(): boolean {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(detectWebGL());
  }, []);

  return supported;
}

export function prefer3DByDefault(width: number, webgl: boolean): boolean {
  return webgl && width >= 640;
}
