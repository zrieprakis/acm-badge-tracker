import type { AcmClient } from './AcmClient.js';
import type { AcmAccessEvent, AcmCardholder } from './types.js';

const DEFAULT_DOORS = [
  'Main Entrance',
  'East Wing Door',
  'Gymnasium Entrance',
  'Staff Parking Lot',
  'Cafeteria Door',
];

const DEFAULT_CARDHOLDERS: AcmCardholder[] = [
  { cardholderId: 'CARD-1001', name: 'Alex Rivera' },
  { cardholderId: 'CARD-1002', name: 'Jordan Lee' },
  { cardholderId: 'CARD-1003', name: 'Sam Patel' },
  { cardholderId: 'CARD-1004', name: 'Taylor Nguyen' },
  { cardholderId: 'CARD-1005', name: 'Morgan Davis' },
];

export interface MockAcmClientOptions {
  cardholders?: AcmCardholder[];
  doors?: string[];
  /** Injectable RNG for deterministic tests; defaults to Math.random. */
  random?: () => number;
  /** Probability (0-1) that a given cardholder generates a new event on each poll. */
  eventProbabilityPerCardholder?: number;
  /** Injectable clock for deterministic tests; defaults to () => new Date(). */
  now?: () => Date;
}

/**
 * Simulated ACM client so the rest of the system (polling, REST API,
 * frontend) can be built and tested before real ACM API docs/credentials
 * are wired in via AvigilonAcmClient (milestone 10).
 */
export class MockAcmClient implements AcmClient {
  private readonly cardholders: AcmCardholder[];
  private readonly doors: string[];
  private readonly random: () => number;
  private readonly eventProbabilityPerCardholder: number;
  private readonly now: () => Date;
  private readonly eventLog: AcmAccessEvent[] = [];
  private nextEventSeq = 1;

  constructor(options: MockAcmClientOptions = {}) {
    this.cardholders = options.cardholders ?? DEFAULT_CARDHOLDERS;
    this.doors = options.doors ?? DEFAULT_DOORS;
    this.random = options.random ?? Math.random;
    this.eventProbabilityPerCardholder = options.eventProbabilityPerCardholder ?? 0.3;
    this.now = options.now ?? (() => new Date());
  }

  async authenticate(): Promise<void> {
    // Simulated ACM session - nothing to do.
  }

  async listCardholders(): Promise<AcmCardholder[]> {
    return this.cardholders;
  }

  async getRecentAccessEvents(cardholderIds: string[], since: Date): Promise<AcmAccessEvent[]> {
    const tracked = new Set(cardholderIds);
    this.generateNewEvents(tracked);
    return this.eventLog.filter(
      (event) => tracked.has(event.cardholderId) && new Date(event.timestamp) > since,
    );
  }

  /** Test/dev helper: force a specific cardholder to badge in right now. */
  simulateEvent(cardholderId: string, doorName?: string): AcmAccessEvent {
    const door = doorName ?? this.pickRandom(this.doors);
    const event: AcmAccessEvent = {
      cardholderId,
      doorName: door,
      doorId: door.toLowerCase().replace(/\s+/g, '-'),
      eventType: 'granted',
      timestamp: this.now().toISOString(),
      rawEventId: `mock-evt-${this.nextEventSeq++}`,
    };
    this.eventLog.push(event);
    return event;
  }

  private generateNewEvents(tracked: Set<string>): void {
    for (const cardholder of this.cardholders) {
      if (tracked.has(cardholder.cardholderId) && this.random() < this.eventProbabilityPerCardholder) {
        this.simulateEvent(cardholder.cardholderId);
      }
    }
  }

  private pickRandom<T>(items: T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }
}
