import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FriendListPage } from './friend-list.page';

describe('FriendListPage', () => {
  let component: FriendListPage;
  let fixture: ComponentFixture<FriendListPage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(FriendListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
