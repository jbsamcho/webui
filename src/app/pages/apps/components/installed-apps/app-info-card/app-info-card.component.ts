import {
  ChangeDetectionStrategy, Component, computed, effect, EventEmitter, Inject, Input, input, InputSignal, Output,
  signal,
  WritableSignal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import ipRegex from 'ip-regex';
import { isEmpty } from 'lodash';
import {
  filter, map, switchMap, take, tap,
} from 'rxjs';
import { appImagePlaceholder, customApp } from 'app/constants/catalog.constants';
import { CatalogAppState } from 'app/enums/catalog-app-state.enum';
import { Role } from 'app/enums/role.enum';
import { WINDOW } from 'app/helpers/window.helper';
import { helptextApps } from 'app/helptext/apps/apps';
import { AppUpgradeDialogConfig } from 'app/interfaces/app-upgrade-dialog-config.interface';
import { App } from 'app/interfaces/app.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { AppLoaderService } from 'app/modules/loader/app-loader.service';
import { CustomAppFormComponent } from 'app/pages/apps/components/custom-app-form/custom-app-form.component';
import { AppRollbackModalComponent } from 'app/pages/apps/components/installed-apps/app-rollback-modal/app-rollback-modal.component';
import { AppUpgradeDialogComponent } from 'app/pages/apps/components/installed-apps/app-upgrade-dialog/app-upgrade-dialog.component';
import { AppStatus } from 'app/pages/apps/enum/app-status.enum';
import { ApplicationsService } from 'app/pages/apps/services/applications.service';
import { InstalledAppsStore } from 'app/pages/apps/store/installed-apps-store.service';
import { ErrorHandlerService } from 'app/services/error-handler.service';
import { IxSlideInService } from 'app/services/ix-slide-in.service';
import { RedirectService } from 'app/services/redirect.service';
import { WebSocketService } from 'app/services/ws.service';

@UntilDestroy()
@Component({
  selector: 'ix-app-info-card',
  templateUrl: './app-info-card.component.html',
  styleUrls: ['./app-info-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppInfoCardComponent {
  app: InputSignal<App> = input<App>();
  @Output() startApp = new EventEmitter<void>();
  @Output() stopApp = new EventEmitter<void>();
  @Input() status: AppStatus;

  readonly imagePlaceholder = appImagePlaceholder;
  readonly isEmpty = isEmpty;

  protected readonly isRollbackPossible: WritableSignal<boolean> = signal(false);

  protected rollbackUpdateButtonSetEffect = effect(() => {
    const app = this.app();
    this.hasUpdates.set(app?.upgrade_available);
    this.isRollbackPossible.set(false);
    this.updateRollbackSetup(app.name);
  }, { allowSignalWrites: true });

  get inProgress(): boolean {
    return [CatalogAppState.Deploying].includes(this.app().state);
  }

  get isAppStopped(): boolean {
    return this.status === AppStatus.Stopped;
  }

  get appDetailsRouterUrl(): string[] {
    const app = this.app();
    return ['/apps', 'available', app.metadata.train, app.id];
  }

  protected readonly requiredRoles = [Role.AppsWrite];

  constructor(
    private ws: WebSocketService,
    private loader: AppLoaderService,
    private redirect: RedirectService,
    private errorHandler: ErrorHandlerService,
    private appService: ApplicationsService,
    private matDialog: MatDialog,
    private dialogService: DialogService,
    private translate: TranslateService,
    private router: Router,
    private installedAppsStore: InstalledAppsStore,
    private slideIn: IxSlideInService,
    @Inject(WINDOW) private window: Window,
  ) {}

  protected hasUpdates = signal(false);

  protected isCustomApp = computed(() => {
    const app = this.app();
    return app?.metadata?.name === customApp;
  });

  openPortalLink(app: App, name = 'web_portal'): void {
    const portalUrl = new URL(app.portals[name]);

    if (portalUrl.hostname === '0.0.0.0') {
      const hostname = this.window.location.hostname;
      const isIpv6 = ipRegex.v6().test(hostname);
      portalUrl.hostname = isIpv6 ? `[${hostname}]` : hostname;
    }

    this.redirect.openWindow(portalUrl.href);
  }

  updateButtonPressed(): void {
    const name = this.app().name;
    this.appService.getAppUpgradeSummary(name).pipe(
      this.loader.withLoader(),
      switchMap(
        (summary) => this.matDialog.open(AppUpgradeDialogComponent, {
          width: '50vw',
          minWidth: '500px',
          maxWidth: '750px',
          data: {
            appInfo: this.app(),
            upgradeSummary: summary,
          } as AppUpgradeDialogConfig,
        }).afterClosed(),
      ),
      filter(Boolean),
      switchMap(
        (version: string) => this.dialogService.jobDialog(
          this.ws.job('app.upgrade', [name, { app_version: version }]),
          { title: helptextApps.apps.upgrade_dialog.job },
        ).afterClosed(),
      ),
      this.errorHandler.catchError(),
      untilDestroyed(this),
    ).subscribe();
  }

  editButtonPressed(): void {
    const app = this.app();
    if (app.custom_app) {
      this.slideIn.open(CustomAppFormComponent, { data: app });
    } else {
      this.router.navigate(['/apps', 'installed', app.metadata.train, app.id, 'edit']);
    }
  }

  deleteButtonPressed(): void {
    const name = this.app().name;

    this.dialogService.confirm({
      title: helptextApps.apps.delete_dialog.title,
      message: this.translate.instant('Delete {name}?', { name }),
      secondaryCheckbox: true,
      secondaryCheckboxText: this.translate.instant('Remove iXVolumes'),
    })
      .pipe(filter(({ confirmed }) => Boolean(confirmed)), untilDestroyed(this))
      .subscribe(({ secondaryCheckbox }) => this.executeDelete(name, secondaryCheckbox));
  }

  executeDelete(name: string, removeIxVolumes = false): void {
    this.dialogService.jobDialog(
      this.ws.job('app.delete', [name, { remove_images: true, remove_ix_volumes: removeIxVolumes }]),
      { title: helptextApps.apps.delete_dialog.job },
    )
      .afterClosed()
      .pipe(
        filter(Boolean),
        this.errorHandler.catchError(),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.installedAppsStore.installedApps$.pipe(
          map((apps) => !apps.length),
          filter(Boolean),
          take(1),
          untilDestroyed(this),
        ).subscribe(() => {
          this.router.navigate(['/apps', 'installed'], { state: { hideMobileDetails: true } });
        });
      });
  }

  rollbackApp(): void {
    this.matDialog.open(AppRollbackModalComponent, { data: this.app() }).afterClosed().pipe(
      untilDestroyed(this),
    ).subscribe();
  }

  private updateRollbackSetup(appName: string): void {
    this.ws.call('app.rollback_versions', [appName]).pipe(
      tap((versions) => this.isRollbackPossible.set(versions.length > 0)),
      untilDestroyed(this),
    ).subscribe();
  }
}
