import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RSearchPage } from './search-list.page';

describe('RSearchPage', () => {
  let component: RSearchPage;
  let fixture: ComponentFixture<RSearchPage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(RSearchPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
