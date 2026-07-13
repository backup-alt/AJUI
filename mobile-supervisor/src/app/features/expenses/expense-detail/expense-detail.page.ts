import { Component } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonCard, IonCardContent, IonBadge, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-expense-detail',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonCard, IonCardContent, IonBadge, IonItem, IonLabel, IonList, DatePipe, CurrencyPipe],
  template: `
    <ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button default-href="/tabs/expenses"></ion-back-button></ion-buttons><ion-title>Expense Details</ion-title></ion-toolbar></ion-header>
    <ion-content class="detail-content"><div class="detail-container"><h2 class="expense-desc">{{ expense?.description || 'Site Expense' }}</h2><div class="expense-amount-large">{{ expense?.amount | currency:'INR':'symbol':'1.0-0' }}</div><ion-badge [color]="expense?.status === 'Pending' ? 'warning' : 'success'">{{ expense?.status }}</ion-badge><ion-card><ion-card-content><ion-list lines="none"><ion-item><ion-label><p>Type</p><h3>{{ expense?.transactionType }}</h3></ion-label></ion-item><ion-item><ion-label><p>Date</p><h3>{{ expense?.date | date:'MMM d, yyyy' }}</h3></ion-label></ion-item><ion-item><ion-label><p>Reference</p><h3>{{ expense?.reference || 'N/A' }}</h3></ion-label></ion-item></ion-list></ion-card-content></ion-card></div></ion-content>
  `,
  styles: [`.detail-content { --background: var(--agb-off-white); } .detail-container { padding: 16px; } .expense-desc { font-size: 22px; font-weight: 700; color: var(--agb-navy); margin: 0 0 8px; } .expense-amount-large { font-size: 32px; font-weight: 700; color: var(--agb-gold-dark); margin: 8px 0; }`],
})
export class ExpenseDetailPage {
  expense = { description: 'Site Expense', amount: 5000, transactionType: 'Material', status: 'Pending', date: new Date().toISOString(), reference: '' };
}