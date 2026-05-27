import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  archiveExt,
  assertValidArchiveUpload,
  isArchiveFilename,
} from './archive-file.js';

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const RAR_MAGIC = Buffer.from('Rar!\x1a\x07\x00', 'ascii');
const SEVEN_Z_MAGIC = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 0]);
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0]);

describe('archiveExt', () => {
  it('recognizes common extensions', () => {
    assert.equal(archiveExt('a.zip'), 'zip');
    assert.equal(archiveExt('b.rar'), 'rar');
    assert.equal(archiveExt('c.7z'), '7z');
    assert.equal(archiveExt('d.tar.gz'), 'tar.gz');
    assert.equal(archiveExt('e.tgz'), 'tgz');
    assert.equal(archiveExt('f.gz'), 'gz');
  });
});

describe('assertValidArchiveUpload', () => {
  it('accepts zip with PK magic', () => {
    const r = assertValidArchiveUpload(
      '资料.zip',
      'application/zip',
      ZIP_MAGIC,
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.ext, 'zip');
  });

  it('accepts rar and 7z magic', () => {
    assert.equal(
      assertValidArchiveUpload('x.rar', 'application/octet-stream', RAR_MAGIC)
        .ok,
      true,
    );
    assert.equal(
      assertValidArchiveUpload(
        'x.7z',
        'application/x-7z-compressed',
        SEVEN_Z_MAGIC,
      ).ok,
      true,
    );
  });

  it('accepts gzip family', () => {
    assert.equal(
      assertValidArchiveUpload('x.tar.gz', 'application/gzip', GZIP_MAGIC).ok,
      true,
    );
    assert.equal(
      assertValidArchiveUpload('x.tgz', 'application/gzip', GZIP_MAGIC).ok,
      true,
    );
  });

  it('rejects wrong magic for extension', () => {
    const r = assertValidArchiveUpload(
      'fake.zip',
      'application/zip',
      Buffer.from([0, 1, 2, 3]),
    );
    assert.equal(r.ok, false);
  });

  it('rejects unknown extension', () => {
    const r = assertValidArchiveUpload(
      'x.exe',
      'application/octet-stream',
      ZIP_MAGIC,
    );
    assert.equal(r.ok, false);
  });
});

describe('isArchiveFilename', () => {
  it('returns true for archives only', () => {
    assert.equal(isArchiveFilename('a.zip'), true);
    assert.equal(isArchiveFilename('b.xlsx'), false);
  });
});
