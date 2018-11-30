/*
 * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
 * the License. A copy of the License is located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */

import React from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    Button, 
    TouchableWithoutFeedback,
    Keyboard,
    Picker,
    ScrollView
} from 'react-native';
import {
    Auth,
    I18n,
    Logger
} from 'aws-amplify';
import { 
    FormField,
    LinkCell, 
    Header, 
    ErrorRow,
    AmplifyButton
} from '../AmplifyUI';
import AuthPiece from './AuthPiece';
import defaultSignUpFields from './common/default-sign-in-fields'


const logger = new Logger('SignUp');
export default class SignUp extends AuthPiece {
    constructor(props) {
        super(props);

        this._validAuthStates = ['signUp'];
        this.state = {};
        this.signUp = this.signUp.bind(this);
        this.sortFields = this.sortFields.bind(this);
        this.getDefaultDialCode = this.getDefaultDialCode.bind(this);
        this.checkCustomSignUpFields = this.checkCustomSignUpFields.bind(this);
        this.defaultSignUpFields = defaultSignUpFields;
        this.needPrefix = this.needPrefix.bind(this);
        this.header = this.props.signUpConfig.header || 'Create a new account';
    }

    validate() {
        const invalids = [];
        this.signUpFields.map((el) => {
            if (el.required && !this.state[el.key]) {
                el.invalid = true;
                invalids.push(el.label);
            } else {
                el.invalid = false;
            }        
        });
        return invalids;
      }

    sortFields() {

        if (this.props.signUpConfig && this.props.signUpConfig.hiddenDefaults && this.props.signUpConfig.hiddenDefaults.length > 0){
            this.defaultSignUpFields = this.defaultSignUpFields.filter((d) => {
              return !this.props.signUpConfig.hiddenDefaults.includes(d.key);
            });
        }

        if (this.checkCustomSignUpFields()) {

          if (!this.props.signUpConfig || !this.props.signUpConfig.hideAllDefaults) {
            // see if fields passed to component should override defaults
            this.defaultSignUpFields.forEach((f, i) => {
              const matchKey = this.signUpFields.findIndex((d) => {
                return d.key === f.key;
              });
              if (matchKey === -1) {
                this.signUpFields.push(f);
              }
            });
          }
    
          /* 
            sort fields based on following rules:
            1. Fields with displayOrder are sorted before those without displayOrder
            2. Fields with conflicting displayOrder are sorted alphabetically by key
            3. Fields without displayOrder are sorted alphabetically by key
          */
          this.signUpFields.sort((a, b) => {
            if (a.displayOrder && b.displayOrder) {
              if (a.displayOrder < b.displayOrder) {
                return -1;
              } else if (a.displayOrder > b.displayOrder) {
                return 1;
              } else {
                if (a.key < b.key) {
                  return -1;
                } else {
                  return 1;
                }
              }
            } else if (!a.displayOrder && b.displayOrder) {
              return 1;
            } else if (a.displayOrder && !b.displayOrder) {
              return -1;
            } else if (!a.displayOrder && !b.displayOrder) {
              if (a.key < b.key) {
                return -1;
              } else {
                return 1;
              }
            }
          });
        } else {
          this.signUpFields = this.defaultSignUpFields;
        }
    }

    needPrefix(key) {
        const field = this.signUpFields.find(e => e.key === key);
        if (key.indexOf('custom:') !== 0) {
          return field.custom ;
        } else if (key.indexOf('custom:') === 0 && field.custom === false) {
          logger.warn('Custom prefix prepended to key but custom field flag is set to false');
        }
        return null;
    }

    getDefaultDialCode() {
        return this.props.signUpConfig &&
        this.props.signUpConfig.defaultCountryCode  &&
        countryDialCodes.indexOf(`+${this.props.signUpConfig.defaultCountryCode}`) !== '-1' ?
        `+${this.props.signUpConfig.defaultCountryCode}` :
        "+1"
    }

    checkCustomSignUpFields() {
        return this.props.signUpConfig &&
        this.props.signUpConfig.signUpFields &&
        this.props.signUpConfig.signUpFields.length > 0
    }

    signUp() {
        const validation = this.validate();
        if (validation && validation.length > 0) {
          return this.error(`The following fields need to be filled out: ${validation.join(', ')}`);
        }
        if (!Auth || typeof Auth.signUp !== 'function') {
            throw new Error('No Auth module found, please ensure @aws-amplify/auth is imported');
        }

        let signup_info = {
            username: this.state.username,
            password: this.state.password,
            attributes: {
                
            }
        };

        const inputKeys = Object.keys(this.state);
        const inputVals = Object.values(this.state);

        inputKeys.forEach((key, index) => {
            if (!['username', 'password', 'checkedValue'].includes(key)) {
                if (key !== 'phone_line_number' && key !== 'dial_code') {
                  const newKey = `${this.needPrefix(key) ? 'custom:' : ''}${key}`;
                  signup_info.attributes[newKey] = inputVals[index];
                } else if (inputVals[index]) {
                    signup_info.attributes['phone_number'] = `+${this.inputs.dial_code}${this.inputs.phone_line_number.replace(/[-()]/g, '')}`
                }
              }
        });

        Auth.signUp(signup_info).then((data) => {
            this.changeState('confirmSignUp', data.user.username)
        })
        .catch(err => this.error(err));
    }

    showComponent(theme) {
        if (this.checkCustomSignUpFields()) {
            this.signUpFields = this.props.signUpConfig.signUpFields;
        }
        this.sortFields();
        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <ScrollView style={theme.section}>
                    <Header theme={theme}>{I18n.get(this.header)}</Header>
                    <View style={theme.sectionBody}>
                    {
                        this.signUpFields.map((field) => {
                            return  (
                                <FormField
                                    key = {field.key}
                                    theme={theme}
                                    type={field.type}
                                    secureTextEntry={field.type === 'password' ? true: false}
                                    onChangeText={(text) => {
                                            const stateObj = this.state;
                                            stateObj[field.key] = text;
                                            this.setState(stateObj)
                                        }
                                    }
                                    label={I18n.get(field.label)}
                                    placeholder={I18n.get(field.placeholder)}
                                    required={field.required}
                                />
                            )
                        })
                    }
                        <AmplifyButton
                            text={I18n.get('Sign Up').toUpperCase()}
                            theme={theme}
                            onPress={this.signUp}
                            disabled={!this.state.username || !this.state.password}
                        />
                    </View>
                    <View style={theme.sectionFooter}>
                        <LinkCell theme={theme} onPress={() => this.changeState('confirmSignUp')}>
                            {I18n.get('Confirm a Code')}
                        </LinkCell>
                        <LinkCell theme={theme} onPress={() => this.changeState('signIn')}>
                            {I18n.get('Sign In')}
                        </LinkCell>
                    </View>
                    <ErrorRow theme={theme}>{this.state.error}</ErrorRow>
                </ScrollView>
            </TouchableWithoutFeedback>
        );
    }


}
