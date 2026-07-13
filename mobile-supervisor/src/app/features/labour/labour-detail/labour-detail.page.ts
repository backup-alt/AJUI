import { Component } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonCard, IonCardContent, IonBadge, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-labour-detail',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonCard, IonCardContent, IonBadge, IonItem, IonLabel, IonList, DatePipe, CurrencyPipe, TitleCasePipe],
  template: `
    <ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button default-href="/tabs/labour"></ion-back-button></ion-buttons><ion-title>Labour Details</ion-title></ion-toolbar></ion-header>
    <ion-content class="detail-content"><div class="detail-container"><h2 class="labour-party">{{ labour?.partyName || 'Labour Entry' }}</h2><ion-badge [color]="labour?.status === 'Pending' ? 'warning' : 'success'">{{ labour?.status }}</ion-badge><ion-card><ion-card-content><ion-list lines="none"><ion-item><ion-label><p>Present Count</p><h3>{{ labour?.presentCount }}</h3></ion-label></ion-item><ion-item><ion-label><p>Daily Wage</p><h3>{{ labour?.dailyWage | currency:'INR':'symbol':'1.0-0' }}</h3></ion-label></ion-item><ion-item><ion-label><p>Shift</p><h3>{{ labour?.shift }}</h3></ion-label></ion-item><ion-item><ion-label><p>Date</p><h3>{{ labour?.attendanceDate | date:'MMM d, yyyy' }}</h3></ion-label></ion-item></ion-list></ion-card-content></ion-card></div></ion-content>
  `,
  styles: [`.detail-content { --background: var(--agb-off-white); } .detail-container { padding: 16px; } .labour-party { font-size: 22px; font-weight: 700; color: var(--agb-navy); margin: 0 0 8px; }`],
})
export class LabourDetailPage {
  labour = { partyName: 'Labour Entry', presentCount: 10, dailyWage: 500, shift: 'Day', status: 'Pending', attendanceDate: new Date().toISOString() };
}