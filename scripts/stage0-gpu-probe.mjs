#!/usr/bin/env node
/**
 * Stage 0 GPU probe v2 — find flag combo that makes headless Chromium use
 * the real NVIDIA GPU for WebGL (not SwiftShader).
 */
import { chromium } from 'playwright';

const EXEC = '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

const PROBES = [
  {
    name: 'vulkan-full',
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
    ],
  },
  {
    name: 'vulkan-no-swiftshader',
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan',
      '--disable-features=AllowSwiftShaderFallback',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
    ],
  },
  {
    name: 'gl-egl-gbm',
    args: [
      '--use-gl=angle',
      '--use-angle=gl-egl',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--disable-software-rasterizer',
      '--disable-vulkan-surface',
    ],
  },
  {
    name: 'egl-native',
    args: [
      '--use-gl=egl',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--disable-software-rasterizer',
    ],
  },
  {
    name: 'vulkan-force-device',
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--vulkan-device-name=NVIDIA',
    ],
  },
];

async function probe({ name, args }) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: EXEC, args, timeout: 45_000 });
    const page = await browser.newPage();
    const info = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { renderer: null };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      };
    });
    console.log(`[${name}]`, JSON.stringify(info));
  } catch (err) {
    console.log(`[${name}] LAUNCH_FAIL ${String(err).split('\n')[0].slice(0, 160)}`);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

for (const p of PROBES) {
  await probe(p);
}
