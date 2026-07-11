import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { IonApp } from "@ionic/angular/standalone";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [IonApp, RouterOutlet],
  template: `
    <ion-app>
      <router-outlet></router-outlet>
    </ion-app>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  ngOnInit() {
    this.applySavedTheme();
  }

  private applySavedTheme() {
    const saved = localStorage.getItem("agb_theme");
    const theme = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark-mode");
    } else if (theme === "light") {
      root.classList.remove("dark-mode");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark-mode", prefersDark);
    }
  }
}