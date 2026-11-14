import type { NodiiClient } from './client';
import type { Database } from './database.types';
import { mapNotification } from './mappers';

let sequence = 0;
type Row = Database['public']['Tables']['notifications']['Row'];
type Event = 'INSERT' | 'UPDATE';
type NotificationChange = NonNullable<ReturnType<typeof mapNotification>>;

/** SOC-50: INSERT·UPDATE는 받는 사람만, DELETE는 이미 받은 ID만 갱신한다. */
export function subscribeNotifications(
  client: NodiiClient,
  me: string,
  onChange: (deletedId?: string) => void,
  onWrite?: (event: Event, row: NotificationChange) => void,
) {
  let active = true;
  const channel = client.channel(`notifications:${me}:${++sequence}`);
  const filter = { schema: 'public', table: 'notifications', filter: `recipient_id=eq.${me}` };
  const write = (event: Event, row: Row) => {
    if (!active || row.recipient_id !== me) return;
    const mapped = onWrite && mapNotification(row);
    if (mapped) onWrite(event, mapped);
    onChange();
  };
  channel
    .on<Row>('postgres_changes', { ...filter, event: 'INSERT' }, ({ new: row }) => {
      write('INSERT', row);
    })
    .on<Row>('postgres_changes', { ...filter, event: 'UPDATE' }, ({ new: row }) => {
      write('UPDATE', row);
    })
    // DEFAULT replica identity는 DELETE의 수신자 필터를 지원하지 않는다.
    // RLS 밖에서 오는 PK는 캐시 일치 여부만 확인하며 UI에 노출하지 않는다.
    .on<Row>(
      'postgres_changes',
      { schema: 'public', table: 'notifications', event: 'DELETE' },
      ({ old }) => {
        if (active && old.id) onChange(old.id);
      },
    )
    .subscribe((status) => {
      if (active && status === 'SUBSCRIBED') onChange();
    });

  return () => {
    active = false;
    void client.removeChannel(channel);
  };
}
