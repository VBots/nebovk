import { CMenu } from '@vbots/cmenu';
import { Context } from 'vk-io';
// import { IMessageContext } from '.';

const MM_NoChat = (context: Context) => !context.isChat;

const onlyAdminCheck = (context: Context) => {
    if (context.session.profile.isAdmin) {
        return true;
    } else {
        context.send(`Нет доступа`);
        return false;
    }
};

export let MMenu = {
    None: new CMenu('None'),
    Close: new CMenu('Close'),

    Start: new CMenu('Start', null, null, ['start', 'go']),

    MainMenu: new CMenu('MainMenu', ['главное меню', 'main menu', 'menu', 'меню']),
    Help: new CMenu('Help', ['help', 'помощь', 'справка', 'хелп']),
    About: new CMenu('About', ['что это', 'о боте']),
    ResetMe: new CMenu('ResetMe', ['resetme', 'rsme']),

    GoPromo: new CMenu('GoPromo', ['gopromo', 'code', 'promo', 'промо', 'код', 'указать код']),

    // Шаблон кнопок "Да, Нет, Отмена" для сцен
    TMPL_YesNo: new CMenu('TMPL_YesNo'),
    TMPL_YesCancel: new CMenu('TMPL_YesCancel'),
    TMPL_Cancel: new CMenu('TMPL_Cancel'),

    // Результаты подтверждений
    Confirm_Yes: new CMenu('Confirm_Yes', ['y', 'yes', 'true', 'да', 'da'], null, 'yes'),
    Confirm_No: new CMenu('Confirm_No', ['n', 'no', 'false', 'не', 'нет'], null, 'no'),
    Confirm_Cancel: new CMenu('Confirm_Cancel', ['cancel', 'отмена'], null, 'cancel'),

    AcceptJoinGroup: new CMenu('AcceptJoinGroup', null, onlyAdminCheck),
    DisplayStorage: new CMenu('DisplayStorage', ['show session', 'session'], onlyAdminCheck),

    // Callbacks
    CB_CallbackMe: new CMenu('CB_CallbackMe', null, MM_NoChat),
    CB_LikeZ: new CMenu('CB_LikeZ'),
};
