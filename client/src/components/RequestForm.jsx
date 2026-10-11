import React, { Fragment as F } from 'react'
// import PropTypes from 'prop-types'
import cx from 'classnames'
import f from 'lodash'
import { Link } from 'react-router-dom'

import * as CONSTANTS from '../constants'
import t from '../locale/translate'
import Icon from './Icons'
import {
  Row,
  Col,
  InputFileUpload,
  FormGroup,
  FormField,
  InputField,
  Select,
  ButtonRadio,
  StatefulForm,
  ButtonDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from './Bootstrap'

import { RequestTotalAmount as TotalAmount, formatCurrency } from './decorators'
import * as formBlocker from './FormBlocker'
import { ConfirmFormNav } from './FormBlocker'
import BuildingAutocomplete from './BuildingAutocomplete'
import RoomAutocomplete from './RoomAutocomplete'
import ModelAutocomplete from './ModelAutocomplete'
import SupplierAutocomplete from './SupplierAutocomplete'
import UserAutocomplete from './UserAutocomplete'

const tmpUppercasey = v => (f.isString(v) ? v.toUpperCase() : v)

const nbsp = '\u00A0'

const prepareFormValues = request => {
  const fields = f.mapValues(f.omit(request, ['room', 'building']), field => {
    if (f.isObject(field)) {
      return field.value
    }
    return field
  })
  // FIXME: server response has lowercase???
  fields.priority = tmpUppercasey(f.get(request, 'priority.value'))
  fields.inspector_priority = tmpUppercasey(
    f.get(request, 'inspector_priority.value')
  )

  fields.attachments = fields.attachments.map(a => ({
    ...a,
    typename: a.__typename
  }))

  fields.room = f.get(request, 'room.value.id')
  fields.building = f.get(request, 'room.value.building.id')

  // extra form controls
  fields._model_as_id = !!f.get(request, 'model.value.id')
  fields._supplier_as_id = !!f.get(request, 'supplier.value.id')
  return fields
}

const requiredLabel = (label, required) => label + (required ? `${nbsp}*` : '')

class RequestForm extends React.Component {
  state = { showValidations: false, ...formBlocker.initialState }
  showValidations = (bool = true) => this.setState({ showValidations: bool })
  isDisabled = (p = this.props) => p.disabled || p.readOnly
  render(
    {
      state,
      props: {
        request,
        id,
        className,
        onCancel,
        onSubmit,
        compactView,
        ...props
      }
    } = this
  ) {
    const formId = id || request.id
    if (!formId) throw new Error('missing ID!')

    const inspectionComments = f.presence(props.inspectionComments)

    return (
      <StatefulForm
        idPrefix={`request_form_${formId}`}
        values={prepareFormValues(request)}
      >
        {({ fields, setValue, getValue, ...formHelpers }) => {
          const formPropsFor = key => {
            const required = request[key] ? request[key].required : null
            const readOnly = request[key] ? !request[key].write : null
            const labelTxt = t(`request_form_field.${key}`)
            return {
              ...formHelpers.formPropsFor(key),
              // add translated labels, with 'required' marker if writable
              label: readOnly ? labelTxt : requiredLabel(labelTxt, required),
              hidden: request[key] ? !request[key].read : false,
              required,
              readOnly,
              ...(readOnly && { type: 'text-static' })
            }
          }

          return (
            <form
              id={formId}
              className={cx('ui-request-form', className, {
                'form-compact': compactView,
                'was-validated': this.state.showValidations
              })}
              onSubmit={e => {
                e.preventDefault()
                onSubmit(fields, () => formBlocker.unblock(this))
              }}
              // NOTE: dont calculate real form diff, just set blocking on first change
              onChange={f.once(e => formBlocker.block(this))}
            >
              <ConfirmFormNav when={state.isBlocking} />

              <Row>
                <Col lg>
                  <Let
                    articleField={formPropsFor('article_name')}
                    modelField={formPropsFor('model')}
                  >
                    {({ articleField, modelField }) => {
                      // NOTE: dependent field model OR article_name
                      const anyRequired =
                        articleField.required || modelField.required
                      return (
                        <Row cls="no-gutters">
                          <Col sm>
                            {!fields._model_as_id ? (
                              <FormField
                                horizontal={compactView}
                                {...articleField}
                              />
                            ) : (
                              <FormGroup
                                horizontal={compactView}
                                label={articleField.label}
                              >
                                <ModelAutocomplete
                                  {...modelField}
                                  label={articleField.label}
                                  required={anyRequired}
                                />
                              </FormGroup>
                            )}
                          </Col>
                          {/* TMP  hidden */}
                          {/* <Col sm="3" cls="pl-sm-3">
                            <FieldTypeToggle
                              {...formPropsFor('_model_as_id')}
                              checked={formPropsFor('_model_as_id').value}
                              disabled={articleField.readOnly}
                            />
                          </Col> */}
                        </Row>
                      )
                    }}
                  </Let>

                  <FormField
                    horizontal={compactView}
                    {...formPropsFor('article_number')}
                  />

                  <RequestInput field={formPropsFor('supplier')}>
                    {supplierField => (
                      <Row cls="no-gutters">
                        <Col sm>
                          {!fields._supplier_as_id ? (
                            <FormField
                              horizontal={compactView}
                              {...formPropsFor('supplier_name')}
                              readOnly={supplierField.readOnly}
                            />
                          ) : (
                            <FormGroup
                              horizontal={compactView}
                              label={supplierField.label}
                            >
                              <SupplierAutocomplete {...supplierField} />
                            </FormGroup>
                          )}
                        </Col>
                        {/* TMP  hidden */}
                        {/* <Col sm="3" cls="pl-sm-3">
                          <FieldTypeToggle
                            {...formPropsFor('_supplier_as_id')}
                            disabled={supplierField.readOnly}
                          />
                        </Col> */}
                      </Row>
                    )}
                  </RequestInput>

                  <FormField
                    horizontal={compactView}
                    {...formPropsFor('receiver')}
                  />

                  <Let
                    roomField={formPropsFor('room')}
                    buildingField={formPropsFor('building')}
                  >
                    {({ roomField, buildingField }) => (
                      <F>
                        <FormGroup
                          horizontal={compactView}
                          label={requiredLabel(
                            buildingField.label,
                            buildingField.write && roomField.required
                          )}
                        >
                          <BuildingAutocomplete
                            {...formPropsFor('building')}
                            disabled={roomField.readOnly}
                            readOnly={roomField.readOnly}
                            required={roomField.required}
                          />
                        </FormGroup>

                        <FormGroup
                          horizontal={compactView}
                          label={roomField.label}
                        >
                          <RoomAutocomplete
                            {...roomField}
                            disabled={roomField.readOnly}
                            buildingId={fields.building}
                          />
                        </FormGroup>
                      </F>
                    )}
                  </Let>

                  <FormField
                    horizontal={compactView}
                    type="textarea"
                    {...formPropsFor('motivation')}
                  />

                  <Let
                    priority={
                      <RequestInput field={formPropsFor('priority')}>
                        {field => (
                          <FormGroup
                            horizontal={compactView}
                            label={field.label}
                          >
                            <Select
                              {...field}
                              options={CONSTANTS.REQUEST_PRIORITIES.map(v => ({
                                value: v,
                                label: t(`priority_label_${v}`)
                              }))}
                            />
                          </FormGroup>
                        )}
                      </RequestInput>
                    }
                    inspectorPriority={
                      <RequestInput field={formPropsFor('inspector_priority')}>
                        {field => (
                          <FormGroup
                            horizontal={compactView}
                            label={field.label}
                          >
                            <Select
                              {...field}
                              options={CONSTANTS.REQUEST_INSPECTOR_PRIORITIES.map(
                                v => ({
                                  value: v,
                                  label: t(`inspector_priority_label_${v}`)
                                })
                              )}
                            />
                          </FormGroup>
                        )}
                      </RequestInput>
                    }
                  >
                    {({ priority, inspectorPriority }) =>
                      compactView ? (
                        <F>
                          {priority}
                          {inspectorPriority}
                        </F>
                      ) : (
                        <Row>
                          <Col sm>{priority}</Col>
                          <Col sm>{inspectorPriority}</Col>
                        </Row>
                      )
                    }
                  </Let>

                  <RequestInput field={formPropsFor('replacement')}>
                    {field => (
                      <FormGroup horizontal={compactView} label={field.label}>
                        <ButtonRadio
                          {...formPropsFor('replacement')}
                          value={
                            f.isBoolean(field.value)
                              ? CONSTANTS.REQUEST_REPLACEMENT_VALUES_MAP[
                                  field.value
                                ]
                              : field.value
                          }
                          options={CONSTANTS.REQUEST_REPLACEMENT_VALUES.map(
                            v => ({
                              value: v,
                              label: t(
                                `request_form_field.request_replacement_labels_${v}`
                              )
                            })
                          )}
                        />
                      </FormGroup>
                    )}
                  </RequestInput>
                </Col>

                <Col lg>
                  <Let
                    price={
                      <RequestInput field={formPropsFor('price_cents')}>
                        {priceField => {
                          const price = f.isNumber(priceField.value)
                            ? priceField.value / 100
                            : priceField.value
                          return (
                            <FormGroup
                              label={priceField.label}
                              labelSmall={t('request_form_field.price_help')}
                              helpText={
                                !priceField.readOnly &&
                                t('request.price_integer_help')
                              }
                            >
                              {priceField.readOnly ? (
                                <samp className="form-control-plaintext">
                                  {formatCurrency(priceField.value)}
                                </samp>
                              ) : (
                                <InputField
                                  {...priceField}
                                  type="number-integer"
                                  value={price}
                                  onChange={e => {
                                    const val = parseInt(e.target.value, 10)
                                    const num = parseInt(val, 10)
                                    setValue(
                                      'price_cents',
                                      f.isNumber(num) && !f.isNaN(num)
                                        ? num * 100
                                        : val
                                    )
                                  }}
                                />
                              )}
                            </FormGroup>
                          )
                        }}
                      </RequestInput>
                    }
                    total={
                      <FormGroup
                        name="price_total"
                        label={t('request_form_field.price_total')}
                        labelSmall={t('request_form_field.price_help')}
                      >
                        <samp className="form-control-plaintext">
                          {formatCurrency(TotalAmount(fields))}
                        </samp>
                      </FormGroup>
                    }
                  >
                    {({ price, total }) => (
                      <Row>
                        <Col sm="6">{price}</Col>
                        <Col sm="6">{total}</Col>
                      </Row>
                    )}
                  </Let>

                  <Let
                    approved={formPropsFor('approved_quantity')}
                    requested={formPropsFor('requested_quantity')}
                    order={formPropsFor('order_quantity')}
                  >
                    {({ approved, requested, order }) => {
                      const allRW = !f.any(
                        [approved, requested, order],
                        'readOnly'
                      )
                      // debugger
                      const inputProps = { cls: 'text-left monospace' }
                      const groupProps = { horizontal: allRW, labelWidth: 6 }
                      return (
                        <Row cls="form-row">
                          <Col sm>
                            <FormGroup {...groupProps} label={requested.label}>
                              <InputField
                                type="number-integer"
                                {...inputProps}
                                {...requested}
                              />
                            </FormGroup>
                          </Col>
                          <Col sm cls="ml-2">
                            <FormGroup {...groupProps} label={approved.label}>
                              <InputField
                                type="number-integer"
                                {...inputProps}
                                {...approved}
                                max={fields.requested_quantity}
                                onChange={({ target: { value } }) => {
                                  setValue('approved_quantity', value)
                                  setValue('order_quantity', value)
                                }}
                              />
                            </FormGroup>
                          </Col>
                          {!!request.order_quantity.read && (
                            <Col sm cls="ml-2">
                              <FormGroup {...groupProps} label={order.label}>
                                <InputField
                                  type="number-integer"
                                  {...inputProps}
                                  {...order}
                                />
                              </FormGroup>
                            </Col>
                          )}
                        </Row>
                      )
                    }}
                  </Let>

                  <RequestInput field={formPropsFor('inspection_comment')}>
                    {field =>
                      !(field.readOnly && !f.present(field.value)) && (
                        <FormField
                          horizontal={compactView}
                          type="textarea"
                          {...field}
                          // NOTE: Give Reason when Partially Accepting or Denying
                          required={
                            field.required ||
                            isInspectedButNotFullyApproved(fields)
                          }
                          invalidFeedback={t(
                            'request.give_reason_when_partially_accepting_or_denying'
                          )}
                          afterInput={
                            inspectionComments &&
                            !field.readOnly && (
                              <Select
                                m="t-3"
                                cls="form-control-sm"
                                emptyOption={t('request.insert_comment_template')}
                                options={f.map(inspectionComments, s => ({
                                  value: s,
                                  label: s
                                }))}
                                // NOTE: we dont want to keep the selected value and just use it once.
                                // Always setting empty value makes it controlled and React resets it for us!
                                value={''}
                                onChange={({ target: { value } }) => {
                                  setValue(
                                    'inspection_comment',
                                    value +
                                      '\n' +
                                      getValue('inspection_comment')
                                  )
                                }}
                              />
                            )
                          }
                        />
                      )
                    }
                  </RequestInput>
                  <FormGroup
                    horizontal={compactView}
                    label={t('request_form_field.attachments')}
                  >
                    <InputFileUpload {...formPropsFor('attachments')} />
                  </FormGroup>
                  <RequestInput field={formPropsFor('user')}>
                    {userField =>
                      // NOTE: don't show at all if not writable
                      !userField.readOnly && (
                        <FormGroup
                          horizontal={compactView}
                          label={userField.label}
                        >
                          <UserAutocomplete onlyRequesters {...userField} />
                        </FormGroup>
                      )
                    }
                  </RequestInput>
                  <Let accTypeField={formPropsFor('accounting_type')}>
                    {({ accTypeField }) =>
                      !accTypeField.hidden && (
                        <>
                          <FormGroup
                            horizontal={compactView}
                            label={accTypeField.label}
                          >
                            <ButtonRadio
                              {...accTypeField}
                              options={['aquisition', 'investment'].map(k => ({
                                value: k,
                                label: t(
                                  `request_form_field.accounting_type_label_${k}`
                                )
                              }))}
                            />
                          </FormGroup>

                          {!!accTypeField.value && (
                            <Let
                              costCenter={formPropsFor('cost_center')}
                              account={formPropsFor('procurement_account')}
                              orderNr={formPropsFor('internal_order_number')}
                              pAccount={formPropsFor('general_ledger_account')}
                            >
                              {({ costCenter, account, orderNr, pAccount }) =>
                                accTypeField.value !== 'investment' ? (
                                  id !== 'new_request' && (
                                    <Row>
                                      <Col>
                                        <FormField {...costCenter} readOnly />
                                      </Col>
                                      <Col>
                                        <FormField {...account} readOnly />
                                      </Col>
                                    </Row>
                                  )
                                ) : (
                                  <Row>
                                    <Col sm>
                                      <FormField
                                        {...orderNr}
                                        // NOTE: dependent field, always required *if* shown!
                                        required={true}
                                        label={requiredLabel(
                                          orderNr.label,
                                          true
                                        )}
                                      />
                                    </Col>

                                    <Col sm>
                                      {id !== 'new_request' && (
                                        <FormField {...pAccount} readOnly />
                                      )}
                                    </Col>
                                  </Row>
                                )
                              }
                            </Let>
                          )}
                        </>
                      )
                    }
                  </Let>

                  <RequestInput field={formPropsFor('order_status')}>
                    {field => (
                      <FormGroup horizontal={compactView} label={field.label}>
                        <Select
                          {...field}
                          emptyOption={false}
                          options={CONSTANTS.ORDER_STATI.map(v => ({
                            value: v,
                            label: t(`order_status_label_${v}`)
                          }))}
                        />
                      </FormGroup>
                    )}
                  </RequestInput>

                  <RequestInput field={formPropsFor('order_comment')}>
                    {field =>
                      !(field.readOnly && !f.present(field.value)) && (
                        <FormField
                          horizontal={compactView}
                          type="textarea"
                          {...field}
                          required={false}
                        />
                      )
                    }
                  </RequestInput>
                </Col>
              </Row>

              <hr className="mt-1 border-style-dashed" />

              <Row m="t-3">
                <Col lg>
                  {!!props.doChangeRequestCategory && (
                    <SelectionDropdown
                      size="sm"
                      toggle={props.onSelectNewRequestCategory}
                      isOpen={props.isSelectingNewCategory}
                      options={props.categories.map(mc => ({
                        key: mc.id,
                        header: mc.name,
                        options: mc.categories.map(c => {
                          const isCurrent = c.id === request.category.value.id
                          return {
                            key: c.id,
                            disabled: isCurrent,
                            onClick: e => props.doChangeRequestCategory(c),
                            children: (
                              <F>
                                {c.name}
                                {isCurrent && (
                                  <F>
                                    {' '}
                                    <Icon.Checkmark cls="pb-1" />
                                  </F>
                                )}
                              </F>
                            )
                          }
                        })
                      }))}
                    >
                      <Icon.Exchange /> {t('form_btn_move_category')}
                    </SelectionDropdown>
                  )}
                  {!!props.doChangeBudgetPeriod && (
                    <SelectionDropdown
                      size="sm"
                      toggle={props.onSelectNewBudgetPeriod}
                      isOpen={props.isSelectingNewBudgetPeriod}
                      options={[
                        {
                          key: 1,
                          options: props.budgetPeriods.map(bp => {
                            const isCurrent =
                              bp.id === request.budget_period.value.id
                            return {
                              key: bp.id,
                              disabled: isCurrent,
                              onClick: e => props.doChangeBudgetPeriod(bp),
                              children: (
                                <F>
                                  {bp.name}
                                  {isCurrent && (
                                    <F>
                                      {' '}
                                      <Icon.Checkmark cls="pb-1" />
                                    </F>
                                  )}
                                </F>
                              )
                            }
                          })
                        }
                      ]}
                    >
                      <Icon.BudgetPeriod /> {t('form_btn_change_budget_period')}
                    </SelectionDropdown>
                  )}
                  {!!props.doDeleteRequest && (
                    <button
                      type="button"
                      className="btn btn-sm m-1 btn-outline-danger btn-massive"
                      onClick={props.doDeleteRequest}
                    >
                      <Icon.Trash /> {t('form_btn_delete')}
                    </button>
                  )}
                </Col>

                <Col lg order="first" className="mt-3 mt-lg-0">
                  <F>
                    {!!onSubmit && (
                      <button
                        className="btn m-1 btn-primary btn-massive"
                        onClick={e => this.showValidations()}
                      >
                        <Icon.Checkmark /> <span>{t('form_btn_save')}</span>
                      </button>
                    )}
                    {!!onCancel && (
                      <button
                        className="btn m-1 btn-outline-secondary btn-massive"
                        onClick={onCancel}
                      >
                        {onSubmit ? t('form_btn_cancel') : t('form_btn_close')}
                      </button>
                    )}
                  </F>

                  {request.id && (
                    <Link
                      className="btn m-1 btn-link"
                      // to={`/requests/${request.short_id}`}
                      to={`/requests/${request.id}`}
                    >
                      <small>
                        <em>{t('request.link_to_request')}</em>
                      </small>
                    </Link>
                  )}
                </Col>
              </Row>

              {window.isDebug && (
                <pre className="mt-4">{JSON.stringify({ fields }, 0, 2)}</pre>
              )}
            </form>
          )
        }}
      </StatefulForm>
    )
  }
}
export default RequestForm

// FIXME: require props.id OR props.request.id
// RequestForm.propTypes = {
//   request: PropTypes.shape({ id: PropTypes.string.isRequired }).isRequired
// }

const SelectionDropdown = ({
  toggle,
  isOpen,
  children,
  menuStyle,
  options,
  size
}) => (
  <ButtonDropdown direction="down" toggle={toggle} isOpen={isOpen}>
    <DropdownToggle
      size={size}
      caret
      outline
      color="dark"
      className="btn m-1 btn-outline-dark btn-massive"
    >
      {children}
    </DropdownToggle>
    <DropdownMenu
      size={size}
      style={{
        maxHeight: '15rem',
        overflow: 'hidden',
        overflowY: 'scroll'
      }}
    >
      {options.map(({ key, header, options }) => (
        <F key={key}>
          {!!header && (
            <DropdownItem header className="my-2">
              {header}
            </DropdownItem>
          )}
          {options.map(({ key, ...props }) => (
            <DropdownItem key={key} {...props} />
          ))}
        </F>
      ))}
    </DropdownMenu>
  </ButtonDropdown>
)

// FIXME: re-enable this or make option for InlineSearch to allow plain text
// const FieldTypeToggle = ({ id, value, label, ...props }) => (
//   <FormGroup>
//     <div className="custom-control custom-checkbox mt-sm-4 pt-sm-3">
//       <input
//         type="checkbox"
//         className="custom-control-input"
//         formNoValidate
//         id={id}
//         {...props}
//         checked={value}
//         value={undefined}
//         label={undefined}
//       />
//       <label className="custom-control-label" htmlFor={id}>
//         <small>{label.replace(/\s/g, nbsp)}</small>
//       </label>
//     </div>
//   </FormGroup>
// )

const isInspectedButNotFullyApproved = fields => {
  const approved_quantity = parseInt(fields.approved_quantity, 10)
  const requested_quantity = parseInt(fields.requested_quantity, 10)
  return approved_quantity < requested_quantity
}

const Let = ({ children, ...props }) => children(props)
const RequestInput = ({ children, field }) => (
  <F>{!field.hidden && children(field)}</F>
)
