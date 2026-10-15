import { getNotifications } from './notifications-module';

// Simula um Expo Go sem o módulo nativo: o import do pacote lança na hora (jest.mock é içado para o topo)
jest.mock('expo-notifications', () => {
  throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
});

it('sem o módulo nativo, devolve null em vez de derrubar o app', () => {
  expect(getNotifications()).toBeNull();
  expect(getNotifications()).toBeNull(); // e não tenta de novo
});
