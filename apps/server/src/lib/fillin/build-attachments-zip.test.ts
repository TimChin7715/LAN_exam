import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getSingleStoredArchiveAttachment,
  resolveFillInAttachmentDownloadFilename,
  safeFillInAttachmentsZipFilename,
} from './build-attachments-zip.js';

describe('getSingleStoredArchiveAttachment', () => {
  it('returns the row when only one archive attachment', () => {
    const row = {
      id: '1',
      fileName: '资料.zip',
      storageKey: 'fill-in-batches/b/attachments/1.zip',
      sortOrder: 0,
    };
    assert.deepEqual(getSingleStoredArchiveAttachment([row]), row);
  });

  it('returns null for spreadsheet-only or multiple files', () => {
    const sheet = {
      id: '1',
      fileName: 'a.xlsx',
      storageKey: 'fill-in-batches/b/attachments/1.xlsx',
      sortOrder: 0,
    };
    const zip = {
      id: '2',
      fileName: 'b.zip',
      storageKey: 'fill-in-batches/b/attachments/2.zip',
      sortOrder: 1,
    };
    assert.equal(getSingleStoredArchiveAttachment([sheet]), null);
    assert.equal(getSingleStoredArchiveAttachment([sheet, zip]), null);
  });
});

describe('resolveFillInAttachmentDownloadFilename', () => {
  it('uses original name for single archive', () => {
    assert.equal(
      resolveFillInAttachmentDownloadFilename(
        [
          {
            id: '1',
            fileName: '资料.rar',
            storageKey: 'x/1.rar',
            sortOrder: 0,
          },
        ],
        '批次标题',
      ),
      '资料.rar',
    );
  });

  it('uses bundled zip name for multiple attachments', () => {
    assert.equal(
      resolveFillInAttachmentDownloadFilename(
        [
          {
            id: '1',
            fileName: 'a.xlsx',
            storageKey: 'x/1.xlsx',
            sortOrder: 0,
          },
          {
            id: '2',
            fileName: 'b.zip',
            storageKey: 'x/2.zip',
            sortOrder: 1,
          },
        ],
        '我的填空',
      ),
      safeFillInAttachmentsZipFilename('我的填空'),
    );
  });
});
