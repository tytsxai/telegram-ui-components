import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface NetworkStatusResult {
    isOffline: boolean;
    isOnline: boolean;
}

/**
 * Hook that returns both isOffline (boolean) for backward compatibility
 * and an object with isOnline property for components that need it.
 */
export const useNetworkStatus = (): boolean & NetworkStatusResult => {
    const isClient = typeof window !== "undefined" && typeof navigator !== "undefined";
    const [isOffline, setIsOffline] = useState(() => (isClient ? !navigator.onLine : false));

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            toast.success("网络已连接");
        };
        const handleOffline = () => {
            setIsOffline(true);
            toast.error("网络已断开，进入离线模式");
        };

        if (!isClient) return;
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isClient]);

    // Return a value that works as boolean (primitive) and has object properties
    // This maintains backward compatibility while adding new properties
    const result = isOffline as boolean & NetworkStatusResult;
    Object.defineProperty(result, 'isOffline', { value: isOffline, enumerable: true });
    Object.defineProperty(result, 'isOnline', { value: !isOffline, enumerable: true });

    return result;
};
