import type { NodiiClient } from './client';
import type { Database } from './database.types';

let sequence = 0;
type Row = Database['public']['Tables']['notifications']['Row'];

/** SOC-50: INSERT·UPDATE는 받는 사람만, DELETE는 이미 받은 ID만 갱신한다. */
export function subscribeNotifications(
  client: NodiiClient,
  me: string,
  onChange: (deletedId?: string) => void,
) {
  let active = true;
  const channel = client.channel(`notifications:${me}:${++sequence}`);
  const filter = { schema: 'public', table: 'notifications', filter: `recipient_id=eq.${me}` };
  channel
    .on<Row>('postgres_changes', { ...filter, event: 'INSERT' }, ({ new: row }) => {
      if (active && row.recipient_id === me) onChange();
    })
    .on<Row>('postgres_changes', { ...filter, event: 'UPDATE' }, ({ new: row }) => {
      if (active && row.recipient_id === me) onChange();
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
