import { useState } from 'react';

export const PRODUCT_NAME = 'Workflow Viewer for Bitbucket';
export const REPO_URL = 'https://github.com/sorenbcoding/workflow-viewer-for-bitbucket';

/** Product logo: diamond frame with the flow glyph, drawn in the app accent. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg className="sbv-logo" viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={`${PRODUCT_NAME} logo`}>
      <polygon points="32,4 60,32 32,60 4,32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="miter" />
      <g transform="translate(32,32)" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
        <rect x="-9" y="-9" width="8" height="6" />
        <rect x="1" y="3" width="8" height="6" />
        <path d="M-5 -3V6H1" />
      </g>
    </svg>
  );
}

/** Footer line with an expandable About section: logo, name, version, author, repository and disclaimer. */
export function AboutFooter({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  return (
    <footer className="sbv-footer">
      <button type="button" className="sbv-link" aria-expanded={open} onClick={() => setOpen(!open)}>
        {PRODUCT_NAME} {version} · About
      </button>
      {open && (
        <div className="sbv-about">
          <Logo size={48} />
          <div>
            <div className="sbv-about__name">{PRODUCT_NAME}</div>
            <div>Version {version}</div>
            <div>By Søren Schytz Birk</div>
            <a className="sbv-link" href={REPO_URL} target="_blank" rel="noreferrer">github.com/sorenbcoding/workflow-viewer-for-bitbucket</a>
            <p className="sbv-muted">
              {PRODUCT_NAME} is an independent open-source project by Søren Schytz Birk (github.com/sorenbcoding) and is not affiliated with, endorsed
              by, or sponsored by UiPath. UiPath and related names are trademarks of UiPath Inc.
            </p>
          </div>
        </div>
      )}
    </footer>
  );
}
