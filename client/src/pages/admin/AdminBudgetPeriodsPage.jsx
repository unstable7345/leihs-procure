import React, { Fragment as F, useState } from 'react'
import cx from 'classnames'
import f from 'lodash'

import { Query, Mutation } from '@apollo/client/react/components'
import gql from 'graphql-tag'

import t from '../../locale/translate'
import { mutationErrorHandler } from '../../apollo-client'
import Icon from '../../components/Icons'
import {
  Button,
  Badge,
  StatefulForm,
  FormField,
  FormGroup,
  Tooltipped
} from '../../components/Bootstrap'
import InputDate from '../../components/Bootstrap/InputDate'
import Loading from '../../components/Loading'
import { ErrorPanel } from '../../components/Error'
import { MainWithSidebar } from '../../components/Layout'
import { formatCurrency } from '../../components/decorators'

// # DATA & ACTIONS
//
const ADMIN_BUDGET_PERIODS_PROPS_FRAGMENT = gql`
  fragment AdminBudgetPeriodProps on BudgetPeriod {
    id
    name
    inspection_start_date
    end_date
    can_delete
    total_price_cents_new_requests
    total_price_cents_inspected_requests
  }
`

const ADMIN_BUDGET_PERIODS_PAGE_QUERY = gql`
  query AdminBudgetPeriods {
    budget_periods {
      ...AdminBudgetPeriodProps
    }
  }
  ${ADMIN_BUDGET_PERIODS_PROPS_FRAGMENT}
`

const ADMIN_UPDATE_BUDGET_PERIODS_MUTATION = gql`
  mutation updateBudgetPeriods($budgetPeriods: [BudgetPeriodInput]) {
    budget_periods(input_data: $budgetPeriods) {
      ...AdminBudgetPeriodProps
    }
  }
  ${ADMIN_BUDGET_PERIODS_PROPS_FRAGMENT}
`

const updateBudgetPeriods = {
  mutation: {
    mutation: ADMIN_UPDATE_BUDGET_PERIODS_MUTATION,
    onError: mutationErrorHandler
    // update: (cache, { data: { budget_periods, ...data } }) => {
    // // update the internal cache with the new data we received.
    // cache.writeQuery({
    //   query: ADMIN_BUDGET_PERIODS_PAGE_QUERY,
    //   data: { budget_periods }
    // })
    // }
  },
  doUpdate: (mutate, fields) => {
    const data = fields
      .filter(i => !i.toDelete && !f.isEmpty(i.name))
      .map(i => f.pick(i, ['id', 'name', 'inspection_start_date', 'end_date']))

    mutate({
      variables: { budgetPeriods: data }
    })
  },
  successFlash: t('form_message_save_success')
}

// # PAGE
//
function AdminBudgetPeriodsPage() {
  const [formKey, setFormKey] = useState(Date.now())

  return (
    <Mutation
      {...updateBudgetPeriods.mutation}
      onCompleted={() => {
        setFormKey({ formKey: Date.now() })
        window && window.scrollTo(0, 0)
        // FIXME: Remove this hack to force a reload of the page
        location.reload()
      }}
    >
      {(mutate, info) => (
        <Query query={ADMIN_BUDGET_PERIODS_PAGE_QUERY} errorPolicy="all">
          {({ loading, error, data }) => {
            if (loading) return <Loading />
            if (error) return <ErrorPanel error={error} data={data} />

            const budgetPeriods = [...data.budget_periods].reverse()

            return (
              <MainWithSidebar>
                <h1 className="h2">{t('admin.budget_periods.title')}</h1>
                <BudgetPeriodsTable
                  budgetPeriods={budgetPeriods}
                  updateAction={fields => {
                    updateBudgetPeriods.doUpdate(mutate, fields)
                  }}
                  key={formKey}
                />
              </MainWithSidebar>
            )
          }}
        </Query>
      )}
    </Mutation>
  )
}

export default AdminBudgetPeriodsPage

// # VIEW PARTIALS
//

const BudgetPeriodsTable = ({ budgetPeriods, updateAction }) => {
  const formValues = budgetPeriods

  return (
    <StatefulForm idPrefix="budgetPeriods" values={formValues}>
      {({ fields, formPropsFor, getValue, setValue }) => {
        const onSave = () => updateAction(fields)
        const onAddRow = () => {
          setValue(fields.length, {})
        }
        return (
          <F>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.budget_periods.name')}</th>
                  <th>{t('admin.budget_periods.inspection_start_date')}</th>
                  <th>{t('admin.budget_periods.end_date_bp')}</th>
                  <th>{t('admin.budget_periods.total_requests')}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(({ toDelete = false, ...bp }, n) => {
                  const canDelete = bp.can_delete
                  return (
                    <tr
                      key={n}
                      className={cx([
                        'rounded',
                        {
                          'bg-danger-light': toDelete,
                          'was-validated bg-info-light': !bp.id
                          // new lines are marked and should show form validation styles
                        }
                      ])}
                    >
                      <td>
                        <FormField
                          required
                          label={t('admin.budget_periods.name')}
                          placeholder={t('admin.budget_periods.name')}
                          hideLabel
                          readOnly={toDelete}
                          {...formPropsFor(`${n}.name`)}
                        />
                      </td>
                      <td>
                        <FormGroup label={t('admin.budget_periods.inspection_start_date')} hideLabel>
                          <InputDate
                            readOnly={toDelete}
                            {...formPropsFor(`${n}.inspection_start_date`)}
                          />
                        </FormGroup>
                      </td>
                      <td>
                        <FormGroup label={t('admin.budget_periods.end_date')} hideLabel>
                          <InputDate
                            readOnly={toDelete}
                            className={cx({ 'text-strike ': toDelete })}
                            {...formPropsFor(`${n}.end_date`)}
                          />
                        </FormGroup>
                      </td>
                      <td>
                        {!canDelete ? (
                          <React.Fragment>
                            <Tooltipped
                              text={t('admin.budget_periods.total_new')}
                            >
                              <Badge info id={`badge_new_${n}`}>
                                <Icon.ShoppingCart />{' '}
                                <samp>
                                  {formatCurrency(
                                    bp.total_price_cents_new_requests
                                  )}
                                </samp>
                              </Badge>
                            </Tooltipped>{' '}
                            <Tooltipped
                              text={
                                t('admin.budget_periods.total_accepted')
                              }
                            >
                              <Badge success id={`badge_inspecten_${n}`}>
                                <Icon.ShoppingCart />{' '}
                                <samp>
                                  {formatCurrency(
                                    bp.total_price_cents_inspected_requests
                                  )}
                                </samp>
                              </Badge>
                            </Tooltipped>
                          </React.Fragment>
                        ) : (
                          <FormGroup>
                            <div className="form-check mt-2">
                              <label className="form-check-label">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={toDelete}
                                  onChange={e => {
                                    setValue(
                                      `${n}.toDelete`,
                                      !!e.target.checked
                                    )
                                  }}
                                />
                                {'remove'}
                              </label>
                            </div>
                          </FormGroup>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="5">
                    <Tooltipped text={t('admin.budget_periods.add')}>
                      <Button color="link" id="add_bp_btn" onClick={onAddRow}>
                        <Icon.PlusCircle color="success" size="2x" />
                      </Button>
                    </Tooltipped>{' '}
                    <Button color="primary" onClick={onSave}>
                      <Icon.Checkmark /> <span>{t('form_btn_save')}</span>
                    </Button>
                  </td>
                </tr>
              </tfoot>
            </table>
            {window.isDebug && <pre>{JSON.stringify(fields, 0, 2)}</pre>}
          </F>
        )
      }}
    </StatefulForm>
  )
}
