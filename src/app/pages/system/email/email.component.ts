import { ApplicationRef, Component, Injector, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Router } from '@angular/router';
import { helptext_system_email as helptext } from 'app/helptext/system/email';
import * as _ from 'lodash';
import { DialogService, RestService, WebSocketService } from '../../../services/';
import { FieldConfig } from '../../common/entity/entity-form/models/field-config.interface';
import { EntityJobComponent } from '../../common/entity/entity-job/entity-job.component';

@Component({
  selector : 'app-email',
  template : `
  <entity-form [conf]="this"></entity-form>
  `
})
export class EmailComponent implements OnDestroy {

  protected resource_name = 'system/email';
  public entityEdit: any;
  public rootEmail: string;
  private em_outgoingserver: any;
  private em_port: any;
  public custActions: Array < any > = [{
    id: 'send_mail',
    name: 'Send Mail',
    function: () => {
      if (this.rootEmail){
        const value = _.cloneDeep(this.entityEdit.formGroup.value);
        const mailObj = {
          "subject" : "FreeNAS Test Message",
          "text" : "This is a test message from FreeNAS.",
        };
        const security_table = {
          'plain':'PLAIN',
          'ssl': 'SSL',
          'tls': 'TLS'
        };
        this.ws.call('system.info').subscribe((res) => {
          const mail_form_payload = {}
          mail_form_payload['fromemail'] = value.em_fromemail
          mail_form_payload['outgoingserver']= value.em_outgoingserver
          mail_form_payload['port']= value.em_port
          mail_form_payload['security']= security_table[value.em_security]
          mail_form_payload['smtp']= value.em_smtp
          mail_form_payload['user']= value.em_user
          mail_form_payload['pass']= value.em_pass1 || this.entityEdit.data.em_pass
          mailObj['subject'] += " hostname: " + res['hostname'];
          this.dialogRef = this.dialog.open(EntityJobComponent, { data: { "title": "EMAIL" }, disableClose: true });
          this.dialogRef.componentInstance.setCall('mail.send', [mailObj, mail_form_payload]);
          this.dialogRef.componentInstance.submit();
          this.dialogRef.componentInstance.success.subscribe((s_res)=>{
            this.dialogRef.close(false);
            this.dialogservice.Info("email", "Test email sent!")
          });
          this.dialogRef.componentInstance.failure.subscribe((e_res) => {
            this.dialogRef.componentInstance.setDescription(e_res.error);
          });
        });
      }
      else{
        this.dialogservice.Info("email", "Configure the root user email address.");
      }
    }
  }
];
  public fieldConfig: FieldConfig[] = [
    {
      type : 'input',
      name : 'em_fromemail',
      placeholder : helptext.em_fromemail.placeholder,
      tooltip : helptext.em_fromemail.tooltip,
    },
    {
      type : 'input',
      name : 'em_outgoingserver',
      placeholder : helptext.em_outgoingserver.placeholder,
      tooltip : helptext.em_outgoingserver.tooltip,
    },
    {
      type : 'input',
      name : 'em_port',
      placeholder : helptext.em_port.placeholder,
      tooltip : helptext.em_port.tooltip,
    },
    {
      type : 'select',
      name : 'em_security',
      placeholder : helptext.em_security.placeholder,
      tooltip : helptext.em_security.tooltip,
      options : [
        {label : 'Plain', value : 'plain'},
        {label : 'SSL', value : 'ssl'},
        {label : 'TLS', value : 'tls'},
      ],
    },
    {
      type : 'checkbox',
      name : 'em_smtp',
      placeholder : helptext.em_smtp.placeholder,
      tooltip : helptext.em_smtp.tooltip,
    },
    {
      type : 'input',
      name : 'em_user',
      placeholder : helptext.em_user.placeholder,
      tooltip : helptext.em_user.tooltip,
      relation : [
        {
          action : 'DISABLE',
          when : [ {
            name : 'em_smtp',
            value : false,
          } ]
        },
      ],
      required: true,
      validation : helptext.em_user.validation
    },
    {
      type: 'paragraph',
      name: 'em_pwmessage',
      paraText: helptext.em_pwmessage.paraText,
    },
    {
      type : 'input',
      name : 'em_pass1',
      placeholder : helptext.em_pass1.placeholder,
      tooltip : helptext.em_pass1.tooltip,
      inputType : 'password',
      relation : [
        {
          action : 'DISABLE',
          when : [ {
            name : 'em_smtp',
            value : false,
          } ]
        },
      ],
      required: true,
      togglePw : true,
      validation : helptext.em_pass1.validation
    }
  ];
  protected dialogRef: any;

  private em_smtp;
  private em_smtp_subscription;
  private em_user;
  private em_pwmessage;
  private em_pass1;

  constructor(protected router: Router, protected rest: RestService,
              protected ws: WebSocketService, protected _injector: Injector,
              protected _appRef: ApplicationRef,private dialogservice: DialogService,
              protected dialog: MatDialog
            ) {}

afterInit(entityEdit: any) {
    this.entityEdit = entityEdit;
    const payload = [];
    payload.push("username");
    payload.push("=");
    payload.push("root");
    this.ws.call('user.query', [[payload]]).subscribe((res)=>{
      this.rootEmail = res[0].email;
    });
    this.em_user = _.find(this.fieldConfig, {'name': 'em_user'});
    this.em_pwmessage = _.find(this.fieldConfig, {'name': 'em_pwmessage'});
    this.em_pass1 = _.find(this.fieldConfig, {'name': 'em_pass1'});

    this.em_smtp = entityEdit.formGroup.controls['em_smtp'];
    this.em_user.isHidden = !this.em_smtp.value;
    this.em_pwmessage.isHidden = !this.em_smtp.value;
    this.em_pass1.isHidden = !this.em_smtp.value;

    this.em_smtp_subscription = this.em_smtp.valueChanges.subscribe((value) => {
      this.em_user.isHidden = !value;
      this.em_pwmessage.isHidden = !value;
      this.em_pass1.isHidden = !value;
      this.em_pass1.hideButton = !value;
    });
  }

  ngOnDestroy() {
    this.em_smtp_subscription.unsubscribe();
  }

}
