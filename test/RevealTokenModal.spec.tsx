import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevealTokenModal } from '../src/client/components/RevealTokenModal';

describe('RevealTokenModal', () => {
  it('shows token once when open', () => {
    render(
      <RevealTokenModal
        open
        token="ctk_testdata"
        warning="Store this token now"
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('token-reveal')).toHaveTextContent('ctk_testdata');
    expect(screen.getByText(/Store this token now/)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <RevealTokenModal open={false} token="ctk_x" onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
