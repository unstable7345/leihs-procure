import React, { useState } from 'react'
// import cx from 'classnames'
import f from 'lodash'

import { Query, Mutation } from '@apollo/client/react/components'
import gql from 'graphql-tag'

import t from '../../locale/translate'
import { mutationErrorHandler } from '../../apollo-client'
import Icon from '../../components/Icons'
import { Button, StatefulForm, FormField } from '../../components/Bootstrap'
import Loading from '../../components/Loading'
import { ErrorPanel } from '../../components/Error'
import { MainWithSidebar } from '../../components/Layout'

// # DATA & ACTIONS
//
const ADMIN_SETTINGS_FRAGMENTS = {
  props: gql`
    fragment AdminSettingsProps on ProcurementSettings {
      contact_url
      inspection_comments
    }
  `
}

const ADMIN_SETTINGS_PAGE_QUERY = gql`
  query AdminSettings {
    settings {
      ...AdminSettingsProps
    }
  }
  ${ADMIN_SETTINGS_FRAGMENTS.props}
`

const ADMIN_UPDATE_SETTINGS_MUTATION = gql`
  mutation updateSettings($settings: ProcurementSettingsInput) {
    settings(input_data: $settings) {
      ...AdminSettingsProps
    }
  }
  ${ADMIN_SETTINGS_FRAGMENTS.props}
`

const updateSettings = {
  mutation: {
    mutation: ADMIN_UPDATE_SETTINGS_MUTATION,
    onError: mutationErrorHandler,
    update: (cache, { data: { settings } }) => {
      // update the internal cache with the new data we received.
      cache.writeQuery({ query: ADMIN_SETTINGS_PAGE_QUERY, data: { settings } })
    }
  },
  doUpdate: (mutate, fields) => {
    const settings = {
      ...fields,
      inspection_comments: fields.inspection_comments
        .split('\n')
        .filter(l => !f.isEmpty(l))
    }

    mutate({ variables: { settings } })
  },
  successFlash: t('form_message_save_success')
}

// # PAGE
//
function AdminSettingsPage() {
  const [formKey, setFormKey] = useState(Date.now())

  return (
    <Mutation
      {...updateSettings.mutation}
      onCompleted={() => {
        setFormKey({ formKey: Date.now() })
        window && window.scrollTo(0, 0)
      }}
    >
      {(mutate, info) => (
        <Query query={ADMIN_SETTINGS_PAGE_QUERY}>
          {({ loading, error, data }) => {
            if (loading) return <Loading />
            if (error) return <ErrorPanel error={error} data={data} />

            const settings = {
              contact_url: f.get(data, 'settings.contact_url'),
              inspection_comments: f
                .get(data, 'settings.inspection_comments')
                .join('\n\n')
            }

            return (
              <MainWithSidebar>
                <h1 className="h2">{t('admin.settings.title')}</h1>
                <SettingsTable
                  settings={settings}
                  updateAction={fields =>
                    updateSettings.doUpdate(mutate, fields)
                  }
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

export default AdminSettingsPage

const SettingsTable = ({ settings, updateAction }) => (
  <StatefulForm idPrefix="settings" values={settings}>
    {({ fields, formPropsFor, getValue, setValue }) => {
      const onSave = () => updateAction(fields)

      return (
        <React.Fragment>
          <form>
            <FormField label={t('admin.settings.contact_url')} {...formPropsFor('contact_url')} />
            <FormField
              type="textarea"
              label={t('admin.settings.inspection_comments')}
              {...formPropsFor('inspection_comments')}
            />
          </form>

          <Button color="primary" onClick={onSave}>
            <Icon.Checkmark /> <span>{t('form_btn_save')}</span>
          </Button>

          {window.isDebug && <pre>{JSON.stringify(fields, 0, 2)}</pre>}
        </React.Fragment>
      )
    }}
  </StatefulForm>
)
