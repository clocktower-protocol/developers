import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeScreen } from '../src/client/components/WelcomeScreen';

describe('WelcomeScreen', () => {
  it('renders GitHub and email sign-in', async () => {
    const user = userEvent.setup();
    const onEmailSubmit = vi.fn();
    render(
      <WelcomeScreen
        error={null}
        busy={false}
        sentTo={null}
        onEmailSubmit={onEmailSubmit}
      />,
    );

    expect(screen.getByRole('link', { name: /continue with github/i })).toHaveAttribute(
      'href',
      '/api/auth/github',
    );
    expect(screen.getByText('Free REST API/MCP keys for developers.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'dev@example.com');
    await user.click(screen.getByRole('button', { name: /email me a sign-in link/i }));
    expect(onEmailSubmit).toHaveBeenCalledWith('dev@example.com');
  });
});
