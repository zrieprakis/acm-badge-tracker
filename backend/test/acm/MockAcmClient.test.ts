import { describe, expect, it } from 'vitest';
import { MockAcmClient } from '../../src/acm/MockAcmClient.js';

describe('MockAcmClient', () => {
  it('lists the configured cardholders', async () => {
    const client = new MockAcmClient({
      cardholders: [{ cardholderId: 'CARD-1', name: 'Test Person' }],
    });

    const cardholders = await client.listCardholders();

    expect(cardholders).toEqual([{ cardholderId: 'CARD-1', name: 'Test Person' }]);
  });

  it('only returns events after the given "since" timestamp', async () => {
    const client = new MockAcmClient({
      cardholders: [],
      eventProbabilityPerCardholder: 0,
    });

    const older = client.simulateEvent('CARD-1');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = client.simulateEvent('CARD-1');

    const cutoff = new Date(older.timestamp);
    const events = await client.getRecentAccessEvents(['CARD-1'], cutoff);

    expect(events.map((e) => e.rawEventId)).toEqual([newer.rawEventId]);
  });

  it('returns well-formed AcmAccessEvent shapes with matching doorId/doorName', async () => {
    const client = new MockAcmClient({ cardholders: [], doors: ['Main Entrance'] });

    const event = client.simulateEvent('CARD-42');

    expect(event).toMatchObject({
      cardholderId: 'CARD-42',
      doorName: 'Main Entrance',
      doorId: 'main-entrance',
      eventType: 'granted',
    });
    expect(event.rawEventId).toBeTruthy();
    expect(new Date(event.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('generates events probabilistically across all configured cardholders when polled', async () => {
    const cardholders = [
      { cardholderId: 'CARD-1', name: 'A' },
      { cardholderId: 'CARD-2', name: 'B' },
    ];
    const client = new MockAcmClient({
      cardholders,
      eventProbabilityPerCardholder: 1, // force every cardholder to badge in on every poll
    });

    const events = await client.getRecentAccessEvents(['CARD-1', 'CARD-2'], new Date(0));

    expect(events).toHaveLength(2);
    expect(new Set(events.map((e) => e.cardholderId))).toEqual(new Set(['CARD-1', 'CARD-2']));
  });
});
