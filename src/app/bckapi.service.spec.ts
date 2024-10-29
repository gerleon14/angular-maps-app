import { TestBed } from '@angular/core/testing';

import { BckapiService } from './bckapi.service';

describe('BckapiService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: BckapiService = TestBed.get(BckapiService);
    expect(service).toBeTruthy();
  });
});
