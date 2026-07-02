import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  fillInScreenshotExportBasename,
  fillInScreenshotExportExt,
  fillInScreenshotStudentFolderName,
} from './screenshot-export-name.js';

describe('fillInScreenshotExportBasename', () => {
  it('uses chinese question number with zero-padded sequence', () => {
    assert.equal(fillInScreenshotExportBasename('1', 1), '第一题01');
    assert.equal(fillInScreenshotExportBasename('1', 2), '第一题02');
    assert.equal(fillInScreenshotExportBasename('2', 1), '第二题01');
    assert.equal(fillInScreenshotExportBasename('14', 1), '第十四题01');
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
