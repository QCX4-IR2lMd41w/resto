import { useCallback } from 'react';
import { ApiError } from '../../api';
import { useApp } from '../../context';
import { navigate } from '../../router';

/** Shared error handling for admin API calls: expired session → login page, otherwise an error flash. */
export function useAdminErrorHandler() {
    const { setFlashes, setUser } = useApp();
    return useCallback(
        (err: unknown) => {
            if (err instanceof ApiError && err.status === 401) {
                setUser(null);
                navigate('/admin/login', { flash: ['error', err.message] });
            } else {
                setFlashes([['error', (err as Error).message]]);
                window.scrollTo(0, 0);
            }
        },
        [setFlashes, setUser],
    );
}
