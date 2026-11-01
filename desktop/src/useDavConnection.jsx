import { useCallback, useEffect, useRef, useState } from 'react';
// Only a successful authenticated DAV operation means online. Browser interface
// status is deliberately not used as proof that the DAV endpoint is reachable.
export function useDavConnection(bridge, ownerWindow) {
  const [state, setState] = useState({ status: 'unconfigured' }),
    [online, setOnline] = useState(false),
    [version, setVersion] = useState(0);
  const configured = useRef(false),
    epoch = useRef(0),
    activity = useRef('unconfigured'),
    pending = useRef(null),
    alive = useRef(true);
  const report = useCallback((status) => {
    activity.current = status;
    epoch.current++;
    if (status === 'configured' || status === 'unconfigured') {
      configured.current = status === 'configured';
      setOnline(false);
      setVersion((v) => v + 1);
    } else if (status === 'success') setOnline(true);
    else if (status === 'error') setOnline(false);
    setState({
      status,
      time: ['success', 'error'].includes(status)
        ? new Date().toLocaleTimeString()
        : undefined,
    });
  }, []);
  const check = useCallback(async () => {
    if (!configured.current || activity.current === 'transferring')
      return false;
    const id = epoch.current;
    if (pending.current?.id === id) return pending.current.promise;
    const promise = (async () => {
      try {
        await bridge.invoke('webdavTest');
        if (alive.current && epoch.current === id && configured.current) {
          setOnline(true);
          setState({
            status: 'success',
            time: new Date().toLocaleTimeString(),
          });
        }
        return true;
      } catch {
        if (alive.current && epoch.current === id) {
          setOnline(false);
          setState({ status: 'error', time: new Date().toLocaleTimeString() });
        }
        return false;
      } finally {
        if (pending.current?.id === id) pending.current = null;
      }
    })();
    pending.current = { id, promise };
    return promise;
  }, [bridge]);
  useEffect(() => {
    alive.current = true;
    check();
    const timer = ownerWindow.setInterval(check, 60000);
    const recheck = () => {
      check();
    };
    ownerWindow.addEventListener('online', recheck);
    ownerWindow.addEventListener('focus', recheck);
    ownerWindow.addEventListener('offline', recheck);
    return () => {
      alive.current = false;
      ownerWindow.clearInterval(timer);
      ownerWindow.removeEventListener('online', recheck);
      ownerWindow.removeEventListener('offline', recheck);
      ownerWindow.removeEventListener('focus', recheck);
    };
  }, [check, ownerWindow, version]);
  return { state, online, report, check };
}
