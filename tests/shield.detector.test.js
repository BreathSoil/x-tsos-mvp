// tests/shield.detector.test.js
const { detectShields } = require('../src/engine/ShieldDetector');

describe('ShieldDetector', () => {
  test('Should detect Shield_1 (如是低 + 无垠高)', () => {
    const breath = { 如是: 0.1, 无垠: 0.75, 破暗: 0.3, 涓流: 0.2, 映照: 0.4 };
    const qi = [0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2];
    expect(detectShields(breath, qi)).toEqual(['Shield_1']);
  });

  test('Should detect Shield_2 (破暗极低)', () => {
    const breath = { 如是: 0.5, 无垠: 0.6, 破暗: 0.1, 涓流: 0.3, 映照: 0.4 };
    const qi = [0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    expect(detectShields(breath, qi)).toEqual(['Shield_2']);
  });

  test('Should detect Shield_3 (映照高 + 涓流低)', () => {
    const breath = { 如是: 0.4, 无垠: 0.5, 破暗: 0.3, 涓流: 0.1, 映照: 0.8 };
    const qi = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    expect(detectShields(breath, qi)).toEqual(['Shield_3']);
  });

  test('Should detect Shield_4 (无垠高 + 如是低 + Qi 低)', () => {
    const breath = { 如是: 0.1, 无垠: 0.8, 破暗: 0.2, 涓流: 0.1, 映照: 0.6 };
    const qi = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2];
    expect(detectShields(breath, qi)).toEqual(['Shield_4']);
  });

  test('Should not trigger any shield when safe', () => {
    const breath = { 如是: 0.5, 无垠: 0.5, 破暗: 0.5, 涓流: 0.5, 映照: 0.5 };
    const qi = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
    expect(detectShields(breath, qi)).toEqual([]);
  });
});
