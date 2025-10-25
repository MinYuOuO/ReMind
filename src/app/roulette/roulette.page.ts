import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-roulette',
  standalone: true,
  templateUrl: 'roulette.page.html',
  styleUrls: ['roulette.page.scss'],
  imports: [CommonModule, FormsModule, IonicModule],
})
export class RoulettePage {
  view: 'ask' | 'roll' | 'result' = 'ask';
  question = 'Where can go ?';
  isSpinning = false;
  resultText = '';
  options = [
    'Coffee Shop', 'Cinema', 'Restaurant', 'Shopping Mall',
    'Beach', 'Karaoke', 'Picnic Park', 'Night Market'
  ];

  goBack() {
    this.view = this.view === 'result' ? 'roll' : 'ask';
  }

  startRoll() {
    if (this.isSpinning) return;
    this.isSpinning = true;
    this.resultText = '';
    setTimeout(() => {
      const i = Math.floor(Math.random() * this.options.length);
      this.resultText = this.options[i];
      this.isSpinning = false;
    }, 2800);
  }
}

