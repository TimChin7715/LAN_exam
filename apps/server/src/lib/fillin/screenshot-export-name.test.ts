import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  fillInScreenshotExportBasename,
  fillInScreenshotExportExt,
  fillInScreenshotStudentFolderName,
} from './screenshot-export-name.js';

describe('fillInScreenshotExportBasename', () => {
  it('single image uses 第x题', () => {
    assert.equal(fillInScreenshotExportBasename('3', 1, 1), '第3题');
  });

  it('multiple images use 第x题1, 第x题2', () => {
    assert.equal(fillInScreenshotExportBasename('1', 1, 2), '第1题1');
    assert.equal(fillInScreenshotExportBasename('1', 2, 2), '第1题2');
    assert.equal(fillInScreenshotExportBasename('5', 3, 3), '第5题3');
  });
});

describe('fillInScreenshotExportExt', () => {
  it('maps mime types', () => {
    assert.equal(fillInScreenshotExportExt('image/png'), 'png');
    assert.equal(fillInScreenshotExportExt('image/webp'), 'webp');
    assert.equal(fillInScreenshotExportExt('image/jpeg'), 'jpg');
  });
});

describe('fillInScreenshotStudentFolderName', () => {
  it('includes name and id tail', () => {
    assert.equal(
      fillInScreenshotStudentFolderName('张三', '110101199001011234'),
      '张三_1234',
    );
  });
});
