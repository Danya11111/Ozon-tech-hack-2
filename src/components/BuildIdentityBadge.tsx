import { useEffect, useState } from 'react';

export interface VersionInfo {
  commit: string;
  branch: string;
  builtAt: string;
  release: string;
}

/**
 * Engineering-only build chip. Hidden in presentation mode.
 * Visible with ?perf=1 or ?build=1.
 */
export default function BuildIdentityBadge() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [show, setShow] = useState(false);
  const [inPresentation, setInPresentation] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShow(params.get('perf') === '1' || params.get('build') === '1');
  }, []);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.commit) setInfo(j as VersionInfo);
      })
      .catch(() => undefined);
    const id = window.setInterval(() => {
      setInPresentation(!!document.querySelector('.presentation-mode'));
    }, 500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [show]);

  if (!show || !info || inPresentation) return null;

  return (
    <div className="build-identity" data-testid="build-identity" title={`${info.branch} · ${info.builtAt}`}>
      <span className="build-identity-label">build</span>
      <span className="build-identity-commit">{info.commit}</span>
      <span className="build-identity-release">{info.release}</span>
    </div>
  );
}
