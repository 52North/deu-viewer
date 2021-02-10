import { Component, EventEmitter, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { EdpError } from '../../../services/error-handling/model';
import { ConfigurationService } from './../../../configuration/configuration.service';

@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss']
})
export class ErrorComponent implements OnInit {

  constructor(
    private translate: TranslateService,
    private config: ConfigurationService
  ) { }

  public close: EventEmitter<void> = new EventEmitter();

  public error!: EdpError;

  public errorMessage: string | undefined;

  ngOnInit(): void {
    if (this.error instanceof EdpError) {
      const translationsKey = this.error.messageKey;
      const translation = this.translate.instant(translationsKey);
      if (translationsKey !== translation) {
        this.errorMessage = translation;
      }
    }
    console.log(this.error);
  }

  public createTicket(): void {
    this.translate.getTranslation('en').subscribe(translation => {
      const ticket = `${this.config.configuration.supportTicketPrefix}${this.error.createTicket(translation)}`;
      window.open(ticket);
    });
  }

}