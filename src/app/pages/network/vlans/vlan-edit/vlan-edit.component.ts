import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { GlobalState } from '../../../../global.state';
import { RestService, WebSocketService, NetworkService } from '../../../../services/';

import { FieldConfig } from '../../../common/entity/entity-form/models/field-config.interface';
import * as _ from 'lodash';

@Component({
  selector: 'app-vlan-edit',
  template: `<entity-form [conf]="this"></entity-form>`
})
export class VlanEditComponent {

  protected resource_name: string = 'network/vlan/';
  protected route_success: string[] = ['network', 'vlans'];
  protected isEntity: boolean = true;

  protected fieldConfig: FieldConfig[] = [
    {
      type: 'input',
      name: 'vlan_vint',
      placeholder: 'Virtual Interface',
      disabled: true
    },
    {
      type: 'select',
      name: 'vlan_pint',
      placeholder: 'Parent Interface',
      options: []
    },
    {
      type: 'input',
      name: 'vlan_tag',
      placeholder: 'Vlan Tag',
    },
    {
      type: 'input',
      name: 'vlan_description',
      placeholder: 'Description',
    },
  ];

  private vlan_pint: any;

  constructor(protected router: Router, protected rest: RestService, protected ws: WebSocketService, protected networkService: NetworkService, protected _state: GlobalState) {

  }

  afterInit(entityAdd: any) {
    this.networkService.getVlanNicChoices().subscribe((res) => {
      this.vlan_pint = _.find(this.fieldConfig, {'name': 'vlan_pint'});
      res.forEach((item) => {
        this.vlan_pint.options.push({ label: item[1], value: item[0] });
      });
    });
  }

}
