import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoulettePage } from './roulette.page';

describe('RoulettePage', () => {
  let component: RoulettePage;
  let fixture: ComponentFixture<RoulettePage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(RoulettePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
