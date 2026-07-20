import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyList } from '../src/client/components/KeyList';

describe('KeyList', () => {
  it('shows empty state', () => {
    render(<KeyList keys={[]} busyId={null} onRevoke={() => {}} />);
    expect(screen.getByTestId('empty-keys')).toBeInTheDocument();
  });

  it('renders keys and confirms revoke', async () => {
    const user = userEvent.setup();
    const onRevoke = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <KeyList
        keys={[
          {
            id: 'key_abc',
            subjectId: 'dev_1',
            tokenHashPrefix: 'deadbeef',
            label: 'local',
            createdAt: Date.now(),
          },
        ]}
        busyId={null}
        onRevoke={onRevoke}
      />,
    );

    expect(screen.getByText('local')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(onRevoke).toHaveBeenCalledWith('key_abc');
  });
});
